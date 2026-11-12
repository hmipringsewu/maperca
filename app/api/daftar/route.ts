import { z } from "zod";
import { getDb } from "@/db";
import { registrations } from "@/db/schema";
import { eq } from "drizzle-orm";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
 const d=new Date(v+"T00:00:00Z"); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===v && v>="1900-01-01" && v<=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"});
},"Tanggal tidak valid atau berada di masa depan.");
const schema=z.object({
 nama:z.string().trim().min(2).max(150),kampus:z.string().trim().min(2).max(150),
 hp:z.string().max(20).transform(v=>v.replace(/[\s-]/g,"")).refine(v=>/^(?:08|628|\+628)\d{7,12}$/.test(v),"Nomor HP Indonesia tidak valid."),
 alamat:z.string().trim().min(10).max(500),jurusan:z.string().trim().min(2).max(150),tempatLahir:z.string().trim().min(2).max(150),
 tanggalLahir:date,tanggalKuliah:date,consent:z.literal(true),requestId:z.string().uuid(),
}).refine(v=>v.tanggalKuliah>v.tanggalLahir,{message:"Tanggal masuk kuliah harus setelah tanggal lahir.",path:["tanggalKuliah"]});
export async function POST(request:Request){
 const origin=request.headers.get("origin");
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:"Permintaan tidak diizinkan."},{status:403});
 if(!request.headers.get("content-type")?.includes("application/json"))return Response.json({error:"Format permintaan tidak valid."},{status:415});
 let raw;try{const body=await request.text();if(body.length>6000)return Response.json({error:"Data terlalu panjang."},{status:413});raw=JSON.parse(body);}catch{return Response.json({error:"Data tidak terbaca."},{status:400});}
 const result=schema.safeParse(raw);
 if(!result.success)return Response.json({error:"Periksa kembali data yang kamu isi. "+result.error.issues[0].message},{status:400});
 try{const db=getDb();const {consent,...data}=result.data;
 const id="MPR-"+crypto.randomUUID().replaceAll("-","").slice(0,12).toUpperCase();
 await db.insert(registrations).values({...data,id,consentAt:new Date().toISOString()}).onConflictDoNothing({target:registrations.requestId});
 const [saved]=await db.select({id:registrations.id,confirmedAt:registrations.instagramConfirmedAt,tiktokConfirmedAt:registrations.tiktokConfirmedAt}).from(registrations).where(eq(registrations.requestId,data.requestId)).limit(1);
 return Response.json({id:saved.id,followConfirmed:!!saved.confirmedAt&&!!saved.tiktokConfirmedAt,tiktokConfirmed:!!saved.tiktokConfirmedAt},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Pendaftaran belum tersimpan. Silakan coba lagi beberapa saat lagi."},{status:503});}
}
