import Provider from 'oidc-provider';
import {sqliteAdapter} from './sqlite-adapter.mjs';

// Factory only: no listener, dotenv loading, production imports or implicit key creation.
export function createProvider({issuer,db,jwks,cookieKeys,clients,findIdentity,allowApp,audit=()=>{},testOnly=false,deployment='production'}) {
  if(testOnly&&process.env.NODE_ENV==='production')throw Error('Test mode is forbidden in production');
  const url=new URL(issuer);
  if(new Set(clients.map(c=>c.client_id)).size!==clients.length||new Set(clients.map(c=>c.client_secret)).size!==clients.length)throw Error('Unique client registrations and secrets required');
  if(!testOnly && (url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/profile' || (deployment!=='staging'&&url.href!=='https://eco.febro.id/profile')))throw Error('Unexpected production issuer');
  if(!cookieKeys?.length || cookieKeys.some(k=>typeof k!=='string'||k.length<48))throw Error('Strong persistent cookie keys required');
  if(!jwks?.keys?.length||jwks.keys.some(k=>!k.kid||!k.d||!['RS256','ES256'].includes(k.alg))||new Set(jwks.keys.map(k=>k.kid)).size!==jwks.keys.length)throw Error('Persistent asymmetric private signing keys with unique IDs required');
  for(const client of clients){
    if(!client.client_id||!client.client_secret||client.client_secret.length<32||!client.redirect_uris?.length)throw Error('Incomplete client');
    for(const uri of [...client.redirect_uris,...(client.post_logout_redirect_uris||[])]){const u=new URL(uri);if(u.hash||u.username||u.password||u.hostname.includes('*')||(!testOnly&&u.protocol!=='https:'))throw Error('Invalid redirect URI');}
    if(!['authorization_code','authorization_code,refresh_token'].includes(client.grant_types?.join())||client.response_types?.join()!=='code'||client.token_endpoint_auth_method!=='client_secret_basic')throw Error('Code-only confidential clients required');
  }
  const provider=new Provider(issuer,{
    adapter:sqliteAdapter(db),clients,jwks,
    subjectTypes:['public'],responseTypes:['code'],scopes:['openid','email','profile','offline_access'],
    claims:{openid:['sub'],email:['email','email_verified'],profile:['name']},
    cookies:{keys:cookieKeys,long:{httpOnly:true,sameSite:'lax',secure:!testOnly},short:{httpOnly:true,sameSite:'lax',secure:!testOnly}},
    pkce:{required:()=>true},
    rotateRefreshToken:()=>true,
    issueRefreshToken:async(_ctx,client,source)=>client.grantTypeAllowed('refresh_token')&&source.scopes.has('offline_access'),
    features:{devInteractions:{enabled:false},revocation:{enabled:true},rpInitiatedLogout:{enabled:true,
      logoutSource:async(ctx,form)=>{
        ctx.type='html';ctx.set('Referrer-Policy','strict-origin');ctx.set('Content-Security-Policy',`default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${clients.flatMap(c=>(c.post_logout_redirect_uris||[]).map(u=>new URL(u).origin)).join(' ')}; base-uri 'none'; frame-ancestors 'none'`);
        ctx.body=`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Febro Space</title><style>:root{color-scheme:light dark;font:16px/1.6 system-ui}body{padding:24px;max-width:32rem;margin:8vh auto}button{display:block;width:100%;padding:12px;margin:12px 0;font:inherit}</style><h1>Keluar dari Febro Space?</h1><p>by Febro Herdyanto</p><p>Sesi lokal aplikasi lain mengikuti masa berlaku masing-masing.</p>${form}<button type="submit" form="op.logoutForm" value="yes" name="logout">Ya, keluar</button><button type="submit" form="op.logoutForm">Batal</button></html>`;
      },postLogoutSuccessSource:async ctx=>{ctx.type='html';ctx.body='<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Febro Space</title><h1>Anda sudah keluar dari Febro Space</h1><p>by Febro Herdyanto</p></html>';}
    }},
    renderError:async ctx=>{ctx.type='html';ctx.body='<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Febro Space</title><h1>Permintaan tidak dapat dilanjutkan</h1><p>Kembali ke aplikasi dan mulai login lagi.</p><p>Febro Space · by Febro Herdyanto</p></html>';},
    ttl:{AccessToken:300,AuthorizationCode:60,IdToken:300,Interaction:600,Session:28800,Grant:28800,RefreshToken:28800},
    interactions:{url:(_ctx,interaction)=>`${issuer}/interaction/${interaction.uid}`},
    async findAccount(ctx,id){
      const user=await findIdentity(id);
      if(!user||user.disabled||!user.email_verified)return undefined;
      if(ctx.oidc?.client && !await allowApp(id,ctx.oidc.client.clientId))return undefined;
      return {accountId:user.id,async claims(){return {sub:user.id,email:user.email,email_verified:true,name:user.name};}};
    },
    async extraTokenClaims(ctx){
      if(!await allowApp(ctx.oidc.account.accountId,ctx.oidc.client.clientId))throw Error('Application access denied');
      return {};
    },
  });
  // Emit fixed event identifiers only. Do not forward error objects, tokens or params.
  for(const event of ['authorization.success','authorization.error','grant.success','grant.error','revocation.success','end_session.success'])provider.on(event,()=>audit({event}));
  return provider;
}
