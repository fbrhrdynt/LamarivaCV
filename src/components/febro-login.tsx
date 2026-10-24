"use client";
import {useEffect,useState} from "react";
export function FebroLogin(){
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{fetch("/api/febro-status",{cache:"no-store"}).then(r=>r.json()).then(v=>setEnabled(v.enabled===true)).catch(()=>{});},[]);
 if(!enabled)return null;
 return <div style={{marginTop:20,marginBottom:12}}>
  <a href="/auth/febro" className="btn full" style={{display:"flex",justifyContent:"center",alignItems:"center",minHeight:48,textAlign:"center",textDecoration:"none",background:"#245b89",color:"#fff",borderRadius:8,fontWeight:700}}>
   Continue with Google via Febro Space
  </a>
  <p style={{fontSize:13,color:"var(--muted,#687782)",marginTop:8,lineHeight:1.5}}>Satu akun untuk Lamariva, Receipt, Itinerary, dan fitur Febro Space lainnya. Akun Lamariva lama dapat dihubungkan setelah login menggunakan metode sebelumnya.</p>
 </div>;
}
