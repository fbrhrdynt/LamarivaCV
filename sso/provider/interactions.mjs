import {randomBytes,createHash} from 'node:crypto';
import {equal} from '../adapters/identity-links.mjs';
const random=()=>randomBytes(32).toString('base64url');
const digest=s=>createHash('sha256').update(s).digest('hex');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Mount BEFORE provider callback, behind the existing eco host authentication.
// authenticate must read the real server-side central session on every request.
// No browser-supplied user ID or assertion is accepted.
export function interactions({provider,issuer,db,authenticate,allowApp,audit=()=>{}}){
 const base=new URL(issuer);const origin=base.origin;
 db.exec('CREATE TABLE IF NOT EXISTS interaction_csrf(uid TEXT PRIMARY KEY,hash TEXT NOT NULL,user_id TEXT NOT NULL,expires INTEGER NOT NULL)');
 return async(req,res)=>{
  const u=new URL(req.url,origin);const match=u.pathname.match(new RegExp('^'+base.pathname.replace(/\/$/,'')+'/interaction/([A-Za-z0-9_-]+)$'));
  if(!match)return false;
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','strict-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'none';style-src 'unsafe-inline';form-action 'self';base-uri 'none';frame-ancestors 'none'");
  try{
   const details=await provider.interactionDetails(req,res);
   if(!equal(details.uid,match[1]))throw Error('Invalid interaction');
   res.setHeader('Content-Security-Policy',`default-src 'none';style-src 'unsafe-inline';form-action 'self' ${new URL(details.params.redirect_uri).origin};base-uri 'none';frame-ancestors 'none'`);
   const user=await authenticate(req,{freshRequired:details.prompt.name==='login'&&(details.params.prompt?.split(' ').includes('login')||String(details.params.max_age)==='0'),interactionCreatedAt:details.iat,interactionUID:details.uid});
   if(!user || user.disabled || !user.email_verified){
    // Login page must retain only this bounded same-origin interaction return.
    res.writeHead(303,{Location:issuer+'/?reauth=1&next='+encodeURIComponent(issuer+'/interaction/'+details.uid)});res.end();return true;
   }
   if(!await allowApp(user.id,details.params.client_id))throw Error('Application access denied');
   if(req.method==='GET'){
    const csrf=random();db.prepare('INSERT OR REPLACE INTO interaction_csrf VALUES(?,?,?,?)').run(details.uid,digest(csrf),user.id,Date.now()+600000);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Febro Space</title><style>:root{font:16px/1.6 system-ui;color-scheme:light dark}*{box-sizing:border-box}body{max-width:32rem;margin:8vh auto;padding:24px;overflow-wrap:anywhere}button{display:block;width:100%;padding:12px;margin:12px 0;font:inherit;cursor:pointer}button:focus-visible{outline:3px solid #3080e8}</style><h1>Febro Space</h1><small>by Febro Herdyanto</small><p>Profil dan email terverifikasi digunakan untuk masuk.</p><p>Lanjutkan ke ${escape(details.params.client_id)} sebagai ${escape(user.name)}.</p><form method="post"><input type="hidden" name="csrf" value="${csrf}"><button name="action" value="continue">Lanjutkan</button><button name="action" value="cancel">Batal</button></form></html>`);return true;
   }
   if(req.method!=='POST'||req.headers.origin!==origin||!String(req.headers['content-type']).startsWith('application/x-www-form-urlencoded'))throw Error('Invalid interaction request');
   let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>2048)throw Error('Body too large');body+=chunk;}
   const form=new URLSearchParams(body);
   const proof=db.prepare('DELETE FROM interaction_csrf WHERE uid=? RETURNING *').get(details.uid);
   if(!proof||proof.user_id!==user.id||proof.expires<=Date.now()||!equal(proof.hash,digest(form.get('csrf')||'')))throw Error('Invalid interaction CSRF');
   if(form.get('action')==='cancel'){await provider.interactionFinished(req,res,{error:'access_denied'},{mergeWithLastSubmission:false});return true;}
   if(form.get('action')!=='continue')throw Error('Invalid action');
   if(details.prompt.name==='login'){
    await provider.interactionFinished(req,res,{login:{accountId:user.id,ts:Math.floor(user.authenticatedAt/1000)||Math.floor(Date.now()/1000)}},{mergeWithLastSubmission:false});
   }else if(details.prompt.name==='consent'){
    if(details.session?.accountId!==user.id)throw Error('Account changed');
    let grant=details.grantId?await provider.Grant.find(details.grantId):undefined;
    if(!grant)grant=new provider.Grant({accountId:user.id,clientId:details.params.client_id});
    if(details.prompt.details.missingOIDCScope)grant.addOIDCScope(details.prompt.details.missingOIDCScope.join(' '));
    if(details.prompt.details.missingOIDCClaims)grant.addOIDCClaims(details.prompt.details.missingOIDCClaims);
    const grantId=await grant.save();await provider.interactionFinished(req,res,{consent:{grantId}},{mergeWithLastSubmission:true});
   }else throw Error('Unsupported prompt');
   audit({event:'interaction.completed',clientId:details.params.client_id,userId:user.id});
  }catch{
   audit({event:'interaction.rejected'});if(!res.headersSent){res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});res.end('Session expired or request rejected. Return to the application and try again.');}
  }
  return true;
 };
}
