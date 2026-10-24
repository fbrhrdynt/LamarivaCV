import {isIP} from 'node:net';
import {randomToken,equal,safeDestination} from './adapters/identity-links.mjs';
import {createClient} from './adapters/client.mjs';
import {digest} from './repository.mjs';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cookies=req=>Object.fromEntries((req.headers.get('cookie')||'').split(';').map(x=>x.trim().split(/=(.*)/s).slice(0,2)));
export function createSSO({app,origin,issuer,clientId,clientSecret,callbackPath,basePath='/auth/febro',repo,currentLocal,reauthenticate,issueSession,audit=()=>{},testOnly=false,clientFactory=createClient,allowGuestLogin=false,localLogout=async()=>{}}){
 if(testOnly&&process.env.NODE_ENV==='production')throw Error('Test mode is forbidden in production');
 if(!testOnly&&(!origin.startsWith('https://')||!issuer.startsWith('https://')))throw Error('HTTPS required');
 const emit=async e=>{await repo.audit?.(e);audit(e);};
 const cookieName=testOnly?'febro_binding':'__Host-febro_binding';const buckets=new Map();
 const cookie=(v,age=600)=>`${cookieName}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${testOnly?'':'; Secure'}`;
 const page=(body,status=200,extra={})=>new Response(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Febro Space · ${escape(app)}</title><style>:root{color-scheme:light dark;font:16px/1.6 system-ui}*{box-sizing:border-box}body{margin:0;padding:24px;overflow-wrap:anywhere}main{max-width:32rem;margin:8vh auto}a{color:inherit}label,input,button{display:block;width:100%;margin:12px 0}input,button{padding:12px;font:inherit}button{cursor:pointer}small{display:block}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #3080e8;outline-offset:3px}</style></head><body><main><a href="/">Kembali ke ${escape(app)}</a><h1>Febro Space</h1><small>by Febro Herdyanto</small>${body}</main></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'strict-origin','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${new URL(issuer).origin}; base-uri 'none'; frame-ancestors 'none'`,...extra}});
 const redirect=(url)=>new Response(null,{status:303,headers:{Location:url,'Cache-Control':'no-store','Referrer-Policy':'strict-origin'}});
 const id=u=>String(u?.id??u?.sub??'');
 async function form(req){if(req.headers.get('origin')!==origin||!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw Error('CSRF');let size=0,parts=[];for await(const p of req.body||[]){size+=p.length;if(size>4096)throw Error('Too large');parts.push(p);}return new URLSearchParams(Buffer.concat(parts).toString());}
 return async function handle(req){
 const url=new URL(req.url);if(url.origin!==origin)return page('<p role="alert">Host tidak valid.</p>',400);
 if(url.pathname!==callbackPath&&!url.pathname.startsWith(basePath))return null;
 let binding=cookies(req)[cookieName];if(!/^[\w-]{43}$/.test(binding||''))binding=null;
 try{
  // Browser-bound limiter adds to app/ingress per-IP limits; never trusts forwarded IPs.
  const peer=req.headers.get('x-febro-peer');const key=peer&&isIP(peer)?peer:binding||'unbound',now=Date.now();for(const [k,v] of buckets)if(v.until<now)buckets.delete(k);
  if(buckets.size>10000)throw Error('Capacity');const b=buckets.get(key)||{until:now+60000,count:0};buckets.set(key,b);if(++b.count>30)return page('<p role="alert">Terlalu banyak percobaan. Coba lagi sebentar.</p>',429);
  let proof;const flowStore={save:async(state,value)=>repo.save('flow:'+state,{...value,proof}),take:async(state)=>{const flow=await repo.take('flow:'+state);proof=flow?.proof;return flow;}};
  if(req.method==='GET'&&url.pathname===basePath){
   binding=randomToken();const local=await currentLocal(req),csrf=randomToken();await repo.save('ui:'+csrf,{binding:digest(binding),localId:id(local),session:local?.sessionHash||''});
   return page(`<h2>Masuk ke ${escape(app)}</h2><p>Akun hanya dihubungkan setelah bukti kepemilikan dan konfirmasi Anda. Gunakan login lama bila akun belum dihubungkan.</p>${local?`<p>Akun lokal: <strong>${escape(local.name||local.nickname||local.email)}</strong></p>`:''}<form method="post" action="${basePath}/start"><input type="hidden" name="csrf" value="${csrf}">${local?'<label>Kata sandi akun lokal (jika tersedia)<input name="password" type="password" autocomplete="current-password" maxlength="128"></label><button name="action" value="link">Hubungkan akun ini dengan Febro Space</button>':'<button name="action" value="login">Login with Febro Space</button>'}<button name="action" value="logout">Keluar aplikasi</button>${allowGuestLogin&&local&&!local.authenticated?'<button name="action" value="login">Masuk ke akun yang sudah dihubungkan</button>':''}</form>`,200,{'Set-Cookie':cookie(binding)});
  }
  if(req.method==='GET'&&url.pathname===basePath+'/logged-out'){
   const state=url.searchParams.get('state'),flow=state?await repo.take('logout:'+state):null;if(!binding||!flow||!equal(flow.binding,digest(binding)))throw Error('Logout state');
   return page('<h2>Anda sudah keluar</h2><p>Anda sudah keluar dari aplikasi ini. Sesi Febro Space dan aplikasi lain mungkin masih aktif.</p>',200,{'Set-Cookie':cookie('',0)});
  }
  if(req.method==='POST'&&url.pathname===basePath+'/start'){
   const f=await form(req),ui=await repo.take('ui:'+f.get('csrf'));if(!binding||!ui||!equal(ui.binding,digest(binding)))throw Error('CSRF');
   if(f.get('action')==='logout'){
    const response=redirect('/');await localLogout(req,response);await emit({event:'sso.logout'});
    try{const state=randomToken();await repo.save('logout:'+state,{binding:digest(binding)});const client=await clientFactory({issuer,clientId,clientSecret,redirectUri:origin+callbackPath,flowStore,testOnly});response.headers.set('Location',client.logout({postLogoutRedirectUri:origin+basePath+'/logged-out',state}));}catch{response.headers.set('Location','/');}return response;
   }
   const local=await currentLocal(req);const link=f.get('action')==='link';
   if(link){if(!local||id(local)!==ui.localId||!equal(local.sessionHash,ui.session)||!await reauthenticate(req,local,f.get('password')))throw Error('Local proof');proof={localId:id(local),session:local.sessionHash,at:Date.now()};}
   else if(f.get('action')!=='login'||local&&(!allowGuestLogin||local.authenticated))throw Error('Existing account');
   const client=await clientFactory({issuer,clientId,clientSecret,redirectUri:origin+callbackPath,flowStore,testOnly});
   return redirect(await client.start({browserSession:binding,destination:'/',link}));
  }
  if(req.method==='GET'&&url.pathname===callbackPath){
   if(!binding)throw Error('Browser binding');const client=await clientFactory({issuer,clientId,clientSecret,redirectUri:origin+callbackPath,flowStore,testOnly});
   const result=await client.callback({url:url.href,browserSession:binding});const local=await currentLocal(req);
   if(result.link){
    if(!proof||!local||id(local)!==proof.localId||!equal(local.sessionHash,proof.session)||Date.now()-proof.at>=300000||!Number.isFinite(result.identity.authenticatedAt)||Date.now()-result.identity.authenticatedAt>=300000||result.identity.authenticatedAt> Date.now()+30000)throw Error('Fresh proof');
    const csrf=randomToken();await repo.save('confirm:'+csrf,{binding:digest(binding),proof,identity:result.identity},Date.now()+300000);
    return page(`<h2>Konfirmasi pengaitan</h2><p>${escape(local.name||local.nickname||local.email)} ↔ ${escape(result.identity.email)}</p><p>Data, skor, dan izin akun lokal tetap dipertahankan.</p><form method="post" action="${basePath}/confirm"><input type="hidden" name="csrf" value="${csrf}"><button>Konfirmasi pengaitan</button></form><a href="/">Batal</a>`);
   }
   if(local&&(!allowGuestLogin||local.authenticated))throw Error('Existing account');const user=await repo.resolve(result.identity.issuer,result.identity.subject);
   if(!user)return page('<h2>Akun belum dihubungkan</h2><p>Masuk menggunakan metode lama, lalu buka halaman ini untuk menghubungkan akun Anda. Tidak ada akun baru yang dibuat.</p>',409);
   const response=redirect(safeDestination(result.destination));await issueSession(user,response,req);response.headers.append('Set-Cookie',cookie('',0));await emit({event:'sso.login'});return response;
  }
  if(req.method==='POST'&&url.pathname===basePath+'/confirm'){
   const f=await form(req),pending=await repo.take('confirm:'+f.get('csrf')),local=await currentLocal(req);
   if(!binding||!pending||!equal(pending.binding,digest(binding))||!local||id(local)!==pending.proof.localId||!equal(local.sessionHash,pending.proof.session)||Date.now()-pending.proof.at>=300000)throw Error('Invalid proof');
   const user=await repo.link({issuer:pending.identity.issuer,subject:pending.identity.subject,localId:id(local)});const response=redirect('/');await issueSession(user,response,req);response.headers.append('Set-Cookie',cookie('',0));audit({event:'sso.linked'});return response;
  }
  return page('<p>Halaman tidak ditemukan.</p>',404);
 }catch{await emit({event:'sso.rejected'}).catch(()=>{});return page(`<h2>Login tidak berhasil</h2><p role="alert">Sesi kedaluwarsa, bukti kepemilikan belum lengkap, atau akun sudah dihubungkan. Akun Anda tidak diganti otomatis. Gunakan login lama atau periksa status pengaitan.</p><a href="${basePath}">Coba lagi</a>`,400);}
 };
}
// Native Node bridge. Called before request body parsers; errors never expose tokens.
export function nodeRequest(req,origin){if(req.headers.host!==new URL(origin).host)throw Error('Unexpected host');const headers=new Headers(req.headers);headers.delete('x-febro-peer');let peer=req.socket.remoteAddress||'';if(['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)&&isIP(String(req.headers['x-real-ip']||'')))peer=req.headers['x-real-ip'];headers.set('x-febro-peer',peer);return new Request(new URL(req.url,origin),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});}
export async function nodeResponse(response,res){res.statusCode=response.status;for(const [k,v]of response.headers)if(k!=='set-cookie')res.setHeader(k,v);const set=response.headers.getSetCookie();if(set.length)res.setHeader('Set-Cookie',set);res.end(Buffer.from(await response.arrayBuffer()));}
// Next.js may use an internal hostname in Request.url. Trust only the configured
// public Host header, then reconstruct the URL from the configured origin.
export function canonicalRequest(req,origin){
 if(req.headers.get('host')!==new URL(origin).host)throw Error('Unexpected host');
 const u=new URL(req.url),request=new Request(new URL(u.pathname+u.search,origin),req);request.headers.delete('x-febro-peer');const peer=req.headers.get('x-real-ip');if(peer&&isIP(peer))request.headers.set('x-febro-peer',peer);return request;
}
