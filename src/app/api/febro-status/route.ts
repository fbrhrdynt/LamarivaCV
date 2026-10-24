export function GET(){return Response.json({enabled:process.env.FEBRO_SSO_ENABLED==='true'},{headers:{'Cache-Control':'no-store'}});}
