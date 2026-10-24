// Node HTTP mount adapter. oidc-provider generates URLs from issuer's path but
// expects its router to receive the path relative to that mount.
export function mountedProvider(provider,issuer){
 const prefix=new URL(issuer).pathname.replace(/\/$/,'');const callback=provider.callback();
 return(req,res)=>{
  const original=req.url;const pathname=original.split('?')[0];
  if(prefix && pathname!==prefix&&!pathname.startsWith(prefix+'/'))return false;
  req.originalUrl=original;
  req.url=prefix?original.slice(prefix.length)||'/':original;
  callback(req,res);return true;
 };
}
