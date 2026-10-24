import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
export const randomToken=()=>randomBytes(32).toString('base64url');
export function equal(a,b){return typeof a==='string'&&typeof b==='string'&&a.length>0&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export function safeDestination(value,fallback='/') {
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20\x7f]/.test(value))return fallback;
  const u=new URL(value,'https://local.invalid');
  if(u.origin!=='https://local.invalid'||/^\/(?:auth|login|logout|api\/auth)(?:\/|$)/.test(u.pathname))return fallback;
  return u.pathname+u.search+u.hash;
}
// Synthetic harness implementation. Production repositories must implement these
// constraints in the SAME database/transaction as their local user check.
export function identityLinks(db,now=Date.now){
  db.exec(`CREATE TABLE external_identities(issuer TEXT NOT NULL,subject TEXT NOT NULL,local_id TEXT NOT NULL,linked_at INTEGER NOT NULL,PRIMARY KEY(issuer,subject),UNIQUE(issuer,local_id));
    CREATE TABLE link_intents(hash TEXT PRIMARY KEY,session_hash TEXT NOT NULL,local_id TEXT NOT NULL,issuer TEXT NOT NULL,subject TEXT NOT NULL,expires INTEGER NOT NULL,csrf_hash TEXT NOT NULL);`);
  return {
    resolve(issuer,subject){return db.prepare('SELECT local_id FROM external_identities WHERE issuer=? AND subject=?').get(issuer,subject)?.local_id;},
    begin({localId,issuer,subject,session,csrf,localAuthenticatedAt,centralAuthenticatedAt}){
      if(!localId||!issuer||!subject||!session||!csrf||![localAuthenticatedAt,centralAuthenticatedAt].every(t=>Number.isFinite(t)&&t<=now()&&now()-t<300000))throw Error('Fresh proof of both identities required');
      const intent=randomToken();db.prepare('INSERT INTO link_intents VALUES(?,?,?,?,?,?,?)').run(hash(intent),hash(session),localId,issuer,subject,now()+300000,hash(csrf));return intent;
    },
    finish({intent,session,csrf,origin,expectedOrigin,localId}){
      if(origin!==expectedOrigin||!origin)throw Error('CSRF origin rejected');
      db.exec('BEGIN IMMEDIATE');
      try{
        const row=db.prepare('DELETE FROM link_intents WHERE hash=? RETURNING *').get(hash(intent));
        if(!row||row.expires<=now()||row.session_hash!==hash(session)||row.csrf_hash!==hash(csrf)||row.local_id!==localId)throw Error('Invalid linking proof');
        db.prepare('INSERT INTO external_identities VALUES(?,?,?,?)').run(row.issuer,row.subject,row.local_id,now());
        db.exec('COMMIT');return row.local_id;
      }catch(e){db.exec('ROLLBACK');throw e;}
    }
  };
}
