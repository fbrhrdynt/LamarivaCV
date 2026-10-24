// Exact production registrations shared by readiness checks and the central host.
export const registrations=Object.freeze({
 lamariva:['https://cv.febro.id','/auth/febro'],
 itinerary:['https://itinerary.febro.id','/auth/space'],
 voltlab:['https://voltlab.febro.id','/api/auth/febro'],
 files:['https://files.febro.id','/auth/febro'],
 play:['https://play.febro.id','/api/leaderboard/auth/febro']
});
export function expectedRegistration(app){
 const row=registrations[app];if(!row)throw Error('Unknown SSO application');
 const [origin,base]=row;
 return {client_id:'febro-'+app+'-v2',callback:origin+(app==='play'?'/api/leaderboard/auth/callback':base+'/callback'),logout:origin+base+'/logged-out'};
}
export function validRegistration(app,client){
 const expected=expectedRegistration(app);
 return client?.client_id===expected.client_id&&
 Array.isArray(client.redirect_uris)&&client.redirect_uris.length===1&&client.redirect_uris[0]===expected.callback&&
 Array.isArray(client.post_logout_redirect_uris)&&client.post_logout_redirect_uris.length===1&&client.post_logout_redirect_uris[0]===expected.logout&&
 client.token_endpoint_auth_method==='client_secret_post'&&client.response_types?.join() ==='code'&&
 ['authorization_code','authorization_code,refresh_token'].includes(client.grant_types?.join())&&
 typeof client.client_secret==='string'&&client.client_secret.length>=32;
}
export function validateRegistrations(clients){
 if(!Array.isArray(clients)||clients.length!==5||new Set(clients.map(c=>c?.client_secret)).size!==5||
 !Object.keys(registrations).every(app=>clients.filter(c=>validRegistration(app,c)).length===1))throw Error('Five exact independent production client registrations required');
 return clients;
}
