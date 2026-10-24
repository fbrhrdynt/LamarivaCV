"use client";
import {useEffect,useState} from 'react';
export function FebroLogin(){const [enabled,setEnabled]=useState(false);useEffect(()=>{fetch('/api/febro-status').then(r=>r.json()).then(v=>setEnabled(v.enabled===true)).catch(()=>{});},[]);return enabled?<a className="btn" href="/auth/febro">Login / hubungkan Febro Space</a>:null;}
