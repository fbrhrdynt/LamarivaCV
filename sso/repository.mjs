import {createHash,randomUUID} from 'node:crypto';
export const digest=s=>createHash('sha256').update(String(s)).digest('hex');
export const policies={lamariva:{table:'"user"',id:'id',type:'text',active:'"suspended"=false'},itinerary:{table:'users',id:'id',type:'bigint',active:"status='active'"},voltlab:{table:'users',id:'id',type:'uuid',active:"status='active'"},files:{table:'accounts',id:'sub',type:'TEXT',active:'blocked=0'},play:{table:'players',id:'id',type:'TEXT',active:'1=1'}};
// Both adapters execute linking in the SAME database transaction as ownership checks.
export function sqliteConnection(db){return {async query(sql,args=[]){const values=[];sql=sql.replace(/\$(\d+)/g,(_,n)=>{values.push(args[Number(n)-1]);return '?';});const stmt=db.prepare(sql);if(/^\s*(SELECT|WITH)/i.test(sql)||/RETURNING/i.test(sql)){const rows=stmt.all(...values);return {rows,rowCount:rows.length};}const r=stmt.run(...values);return {rows:[],rowCount:Number(r.changes)};},async transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=await fn(this);db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};}
export function pgConnection(pool){return {query:(...args)=>pool.query(...args),async transaction(fn){const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};}
export function migration(app){const p=policies[app];if(!p)throw Error('Unknown app');return [
 'CREATE TABLE IF NOT EXISTS febro_sso_state (key_hash TEXT PRIMARY KEY,payload TEXT NOT NULL,expires BIGINT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS febro_sso_audit(id TEXT PRIMARY KEY,event TEXT NOT NULL,created_at BIGINT NOT NULL)',
 'CREATE INDEX IF NOT EXISTS febro_sso_expiry ON febro_sso_state(expires)',
 `CREATE TABLE IF NOT EXISTS febro_identities (issuer TEXT NOT NULL,subject TEXT NOT NULL,local_id ${p.type} NOT NULL REFERENCES ${p.table}(${p.id}),linked_at BIGINT NOT NULL,PRIMARY KEY(issuer,subject),UNIQUE(issuer,local_id))`
 ,...(app==='play'?['CREATE TABLE IF NOT EXISTS febro_play_sessions(hash TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id),expires BIGINT NOT NULL)']:[])
 ];}
export function repository(connection,app){const p=policies[app];if(!p)throw Error('Unknown app');const q=(...a)=>connection.query(...a);return {
 async audit({event}){if(!['sso.login','sso.linked','sso.rejected','sso.logout'].includes(event))throw Error('Unknown audit event');await q('INSERT INTO febro_sso_audit VALUES($1,$2,$3)',[randomUUID(),event,Date.now()]);},
 async migrate(){for(const sql of migration(app))await q(sql);},
 async save(key,payload,expires=Date.now()+600000){await q('DELETE FROM febro_sso_state WHERE expires<=$1',[Date.now()]);await q('DELETE FROM febro_sso_audit WHERE created_at<$1',[Date.now()-30*86400000]);await q('INSERT INTO febro_sso_state(key_hash,payload,expires) VALUES($1,$2,$3)',[digest(key),JSON.stringify(payload),expires]);},
 async take(key){const r=await q('DELETE FROM febro_sso_state WHERE key_hash=$1 RETURNING payload,expires',[digest(key)]);const row=r.rows[0];return row&&Number(row.expires)>Date.now()?JSON.parse(row.payload):undefined;},
 async resolve(issuer,subject){return (await q(`SELECT u.* FROM febro_identities i JOIN ${p.table} u ON u.${p.id}=i.local_id WHERE i.issuer=$1 AND i.subject=$2 AND ${p.active}`,[issuer,subject])).rows[0];},
 async link({issuer,subject,localId}){return connection.transaction(async c=>{
  const user=(await c.query(`SELECT * FROM ${p.table} WHERE ${p.id}=$1 AND ${p.active}${['files','play'].includes(app)?'':' FOR UPDATE'}`,[localId])).rows[0];if(!user)throw Error('Account unavailable');
  await c.query('INSERT INTO febro_identities(issuer,subject,local_id,linked_at) VALUES($1,$2,$3,$4)',[issuer,subject,localId,Date.now()]);await c.query('INSERT INTO febro_sso_audit VALUES($1,$2,$3)',[randomUUID(),'sso.linked',Date.now()]);return user;
 });}
};}
