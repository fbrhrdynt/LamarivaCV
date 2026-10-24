import * as oidc from 'openid-client';
import {randomToken,equal,safeDestination} from './identity-links.mjs';
// flowStore must be a dedicated server-side store implementing save and atomic
// take. Bind it to a random browser session; never store verifier in a URL/cookie.
export async function createClient({issuer,clientId,clientSecret,redirectUri,flowStore,testOnly=false}){
 if(testOnly&&process.env.NODE_ENV==='production')throw Error('Test mode is forbidden in production');
 const expected=new URL(redirectUri),server=new URL(issuer);
 if([expected,server].some(u=>u.username||u.password||u.hash||u.hostname.includes('*')))throw Error('Invalid OIDC endpoint');
 if(!testOnly&&(expected.protocol!=='https:'||server.protocol!=='https:'))throw Error('HTTPS required');
 const config=await oidc.discovery(server,clientId,{client_secret:clientSecret},(issuer==='https://auth.febro.id'?oidc.ClientSecretPost(clientSecret):oidc.ClientSecretBasic(clientSecret)),testOnly?{execute:[oidc.allowInsecureRequests]}:undefined);
 oidc.enableNonRepudiationChecks(config);config.timeout=12;
 return {
  logout({postLogoutRedirectUri,state}){return oidc.buildEndSessionUrl(config,{client_id:clientId,post_logout_redirect_uri:postLogoutRedirectUri,state}).href;},
  async start({browserSession,destination='/',link=false}){
   if(!browserSession)throw Error('Browser binding required');
   if(link&&!config.serverMetadata().claims_supported?.includes('auth_time'))throw Error('Provider cannot prove fresh authentication for account linking');
   const state=randomToken(),nonce=randomToken(),verifier=oidc.randomPKCECodeVerifier();
   const flow={state,nonce,verifier,browserSession,destination:safeDestination(destination),link,expires:Date.now()+600000};
   await flowStore.save(state,flow);
   return oidc.buildAuthorizationUrl(config,{redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',...(link?{prompt:'login',max_age:'0'}:{})}).href;
  },
  async callback({url,browserSession}){
   const current=new URL(url);
   if(current.origin!==expected.origin||current.pathname!==expected.pathname)throw Error('Callback target rejected');
   const state=current.searchParams.get('state');if(!state)throw Error('Missing state');
   const flow=await flowStore.take(state);
   if(!flow||flow.expires<=Date.now()||!equal(flow.browserSession,browserSession)||!equal(flow.state,state))throw Error('Invalid browser flow');
   const tokens=await oidc.authorizationCodeGrant(config,current,{expectedState:state,expectedNonce:flow.nonce,pkceCodeVerifier:flow.verifier,idTokenExpected:true,...(flow.link?{maxAge:0}:{})},{redirect_uri:redirectUri});
   const idClaims=tokens.claims();
   if(!idClaims?.sub)throw Error('Missing subject');
   const profile=await oidc.fetchUserInfo(config,tokens.access_token,idClaims.sub);
   const claims={...profile,...idClaims};
   if(!claims?.sub||typeof claims.sub!=='string'||claims.sub.length>255||claims.email_verified!==true||typeof claims.email!=='string')throw Error('Verified identity required');
   // Tokens deliberately stay on the server and are not returned to caller/UI.
   return {identity:{issuer,subject:claims.sub,email:claims.email,name:String(claims.name||'').slice(0,120),authenticatedAt:claims.auth_time?claims.auth_time*1000:undefined},destination:flow.destination,link:flow.link};
  },
 };
}
export function sqliteFlows(db){
 db.exec('CREATE TABLE IF NOT EXISTS rp_flows(state TEXT PRIMARY KEY,payload TEXT NOT NULL,expires INTEGER NOT NULL)');
 return {async save(state,flow){db.prepare('DELETE FROM rp_flows WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO rp_flows VALUES(?,?,?)').run(state,JSON.stringify(flow),flow.expires);},async take(state){const row=db.prepare('DELETE FROM rp_flows WHERE state=? RETURNING payload').get(state);return row?JSON.parse(row.payload):undefined;}};
}
