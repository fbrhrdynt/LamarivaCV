import {isIP} from 'node:net';
// Local process rate limiter; production ingress must add shared limits if scaled.
export function httpGuard({limit=60,period=60000,maxEntries=10000,now=Date.now,trustLoopbackProxy=false}={}){
 const buckets=new Map();
 return(req,res)=>{
  const time=now();for(const [key,b]of buckets)if(b.until<=time)buckets.delete(key);
  // Socket address only: forwarded addresses require explicit trusted-proxy handling.
  let key=req.socket.remoteAddress||'unknown';
  const forwarded=req.headers?.['x-real-ip'];if(trustLoopbackProxy&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(key)&&typeof forwarded==='string'&&isIP(forwarded))key=forwarded;let b=buckets.get(key);
  if(!b){if(buckets.size>=maxEntries){res.writeHead(429,{'Cache-Control':'no-store'});res.end();return false;}b={count:0,until:time+period};buckets.set(key,b);}
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  if(++b.count>limit){res.writeHead(429,{'Retry-After':String(Math.max(1,Math.ceil((b.until-time)/1000)))});res.end('Too many requests');return false;}
  return true;
 };
}
