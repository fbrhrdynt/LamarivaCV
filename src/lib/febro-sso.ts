import {Pool} from 'pg';
import {createHmac} from 'node:crypto';
import {verifyPassword} from 'better-auth/crypto';
import {auth} from './auth';
import {db} from './db';
import {createSSO,canonicalRequest} from '../../sso/http.mjs';
import {repository,pgConnection,digest} from '../../sso/repository.mjs';
let handler:ReturnType<typeof createSSO>|undefined;
export async function febroSSO(req:Request){
 if(process.env.FEBRO_SSO_ENABLED!=='true')return new Response('SSO belum diaktifkan.',{status:404});
 const origin=new URL(process.env.APP_URL!).origin;
 handler??=createSSO({app:'Lamariva',origin,issuer:process.env.FEBRO_SSO_ISSUER!,clientId:process.env.FEBRO_SSO_CLIENT_ID!,clientSecret:process.env.FEBRO_SSO_CLIENT_SECRET!,callbackPath:'/auth/febro/callback',repo:repository(pgConnection(new Pool({connectionString:process.env.DATABASE_URL,max:3})),'lamariva'),testOnly:process.env.FEBRO_SSO_TEST_ONLY==='true',
 currentLocal:async(r:Request)=>{const session=await auth.api.getSession({headers:r.headers});if(!session)return null;const u=await db.user.findUnique({where:{id:session.user.id}});return u&&!u.suspended?{...u,authenticatedAt:new Date(session.session.createdAt).getTime(),sessionHash:digest(session.session.token)}:null;},
 reauthenticate:async(_r:Request,u:any,password:string)=>{const account=await db.account.findFirst({where:{userId:u.id,providerId:'credential'}});return account?.password?verifyPassword({hash:account.password,password}):u.authenticatedAt>Date.now()-300000;},
 localLogout:async(r:Request,response:Response)=>{const old=await auth.api.getSession({headers:r.headers});if(old)await db.session.deleteMany({where:{token:old.session.token}});const ctx=await auth.$context;response.headers.append('Set-Cookie',`${ctx.authCookies.sessionToken.name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${ctx.authCookies.sessionToken.attributes.secure?'; Secure':''}`);},
 issueSession:async(u:any,response:Response,r:Request)=>{
  const old=await auth.api.getSession({headers:r.headers});
  const context=await auth.$context;const session=await context.internalAdapter.createSession(u.id);if(!session)throw Error('Session rejected');
  if(old)await db.session.deleteMany({where:{token:old.session.token,userId:u.id}});
  // Match the installed Better Auth signed-cookie format; cache remains disabled.
  const signature=createHmac('sha256',context.secret).update(session.token).digest('base64');const cookie=context.authCookies.sessionToken;
  response.headers.append('Set-Cookie',`${cookie.name}=${encodeURIComponent(session.token+'.'+signature)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${cookie.attributes.secure?'; Secure':''}`);
 }});
 return (await handler(canonicalRequest(req,origin)))||new Response('Not found',{status:404});
}
