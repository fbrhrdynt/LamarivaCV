import {validateRegistrations} from './registrations.mjs';
import fs from 'node:fs';import path from 'node:path';
const app=process.argv[2],origins={lamariva:'https://cv.febro.id',itinerary:'https://itinerary.febro.id',voltlab:'https://voltlab.febro.id',files:'https://files.febro.id',play:'https://play.febro.id'};
if(process.env.FEBRO_SSO_TEST_ONLY==='true')throw Error('Test mode cannot be deployed');
if(app==='central'){
 if(process.env.FEBRO_PROVIDER_ENABLED!=='true')throw Error('Provider enablement must be explicitly configured');
 if(process.env.FEBRO_DEPLOYMENT_ENV==='staging')throw Error('Staging configuration cannot activate production');
 const dir=process.env.FEBRO_PROVIDER_DATA_DIR;if(!dir||!path.isAbsolute(dir))throw Error('Private persistent provider directory required');const file=path.join(dir,'configuration.json');const stat=fs.lstatSync(file);if(stat.isSymbolicLink()||stat.mode&0o077)throw Error('Signing configuration permissions invalid');const config=JSON.parse(fs.readFileSync(file,'utf8'));validateRegistrations(config.clients);if(config.clients?.length!==5||new Set(config.clients.map(c=>c.client_secret)).size!==5||!config.jwks?.keys?.length||!config.cookieKeys?.length)throw Error('Complete independent registrations and persistent keys required');
}else{
 if(!origins[app]||process.env.FEBRO_SSO_ENABLED!=='true'||process.env.FEBRO_SSO_ISSUER!=='https://eco.febro.id/profile'||process.env.FEBRO_SSO_CLIENT_ID!=='febro-'+app+'-v2'||(process.env.FEBRO_SSO_CLIENT_SECRET||'').length<32)throw Error('Complete production SSO configuration required');
 const discovery=await fetch('https://eco.febro.id/profile/.well-known/openid-configuration',{signal:AbortSignal.timeout(12000)});if(!discovery.ok||(await discovery.json()).issuer!=='https://eco.febro.id/profile')throw Error('Accepted HTTPS provider must be activated before any relying party');
 const origin=app==='play'?process.env.PUBLIC_ORIGIN:process.env.APP_URL;if(origin!==origins[app])throw Error('Exact reviewed application origin required');
}
console.log('Production configuration shape verified; HTTPS acceptance and approval remain external gates.');
