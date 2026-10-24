// Dedicated isolated database only; never pass an application database here.
export function sqliteAdapter(db, now = () => Math.floor(Date.now()/1000)) {
  db.exec(`CREATE TABLE IF NOT EXISTS oidc_objects(model TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,expires INTEGER,uid TEXT,user_code TEXT,grant_id TEXT,PRIMARY KEY(model,id));
    CREATE INDEX IF NOT EXISTS oidc_uid ON oidc_objects(model,uid);
    CREATE INDEX IF NOT EXISTS oidc_grant ON oidc_objects(grant_id);`);
  return class Adapter {
    constructor(model) { this.model=model; }
    async upsert(id,payload,ttl) {
      db.prepare(`INSERT INTO oidc_objects VALUES(?,?,?,?,?,?,?) ON CONFLICT(model,id) DO UPDATE SET payload=excluded.payload,expires=excluded.expires,uid=excluded.uid,user_code=excluded.user_code,grant_id=excluded.grant_id`)
        .run(this.model,id,JSON.stringify(payload),typeof ttl==='number'?now()+ttl:null,payload.uid??null,payload.userCode??null,payload.grantId??null);
    }
    async find(id) { return this.read('id',id); }
    async findByUid(uid) { return this.read('uid',uid); }
    async findByUserCode(code) { return this.read('user_code',code); }
    read(column,value) {
      const row=db.prepare(`SELECT payload FROM oidc_objects WHERE model=? AND ${column}=? AND (expires IS NULL OR expires>?)`).get(this.model,value,now());
      return row?JSON.parse(row.payload):undefined;
    }
    async consume(id) {
      db.prepare("UPDATE oidc_objects SET payload=json_set(payload,'$.consumed',?) WHERE model=? AND id=?").run(now(),this.model,id);
    }
    async destroy(id) {db.prepare('DELETE FROM oidc_objects WHERE model=? AND id=?').run(this.model,id);}
    async revokeByGrantId(id) {db.prepare('DELETE FROM oidc_objects WHERE grant_id=?').run(id);}
  };
}
