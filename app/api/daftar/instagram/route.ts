import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { registrations } from "@/db/schema";

const schema = z.discriminatedUnion("action", [
  z.object({action:z.literal("open"),platform:z.enum(["instagram","tiktok"]).default("instagram"),id:z.string().regex(/^MPR-[A-F0-9]{12}$/),requestId:z.string().uuid()}),
  z.object({action:z.literal("confirm"),id:z.string().regex(/^MPR-[A-F0-9]{12}$/),requestId:z.string().uuid(),confirmed:z.literal(true),tiktokConfirmed:z.literal(true)}),
]);
export async function POST(request:Request){
  const headers={"Cache-Control":"no-store"};
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:"Permintaan tidak diizinkan."},{status:403,headers});
  if(!request.headers.get("content-type")?.includes("application/json"))return Response.json({error:"Format permintaan tidak valid."},{status:415,headers});
  let raw;
  try{const body=await request.text();if(body.length>1000)return Response.json({error:"Data terlalu panjang."},{status:413,headers});raw=JSON.parse(body);}
  catch{return Response.json({error:"Data tidak terbaca."},{status:400,headers});}
  const parsed=schema.safeParse(raw);
  if(!parsed.success)return Response.json({error:"Konfirmasi belum lengkap."},{status:400,headers});
  const data=parsed.data;
  try{
    const db=getDb();const owner=and(eq(registrations.id,data.id),eq(registrations.requestId,data.requestId));
    const [record]=await db.select({openedAt:registrations.instagramOpenedAt,tiktokOpenedAt:registrations.tiktokOpenedAt,confirmedAt:registrations.instagramConfirmedAt,tiktokConfirmedAt:registrations.tiktokConfirmedAt}).from(registrations).where(owner).limit(1);
    if(!record)return Response.json({error:"Pendaftaran tidak ditemukan."},{status:404,headers});
    if(data.action==="open"){
      if(data.platform==="tiktok")await db.update(registrations).set({tiktokOpenedAt:new Date().toISOString()}).where(and(owner,isNull(registrations.tiktokOpenedAt)));
      else await db.update(registrations).set({instagramOpenedAt:new Date().toISOString()}).where(and(owner,isNull(registrations.instagramOpenedAt)));
      return Response.json({opened:true},{headers});
    }
    if(!record.openedAt)return Response.json({error:"Buka Instagram @hmipringsewu dan ikuti akunnya terlebih dahulu."},{status:409,headers});
    if(!record.tiktokOpenedAt)return Response.json({error:"Buka TikTok @hmipringsewu dan ikuti akunnya terlebih dahulu."},{status:409,headers});
    // These are participant declarations, not verification from the platforms.
    const now=new Date().toISOString();
    await db.update(registrations).set({instagramConfirmedAt:record.confirmedAt||now,tiktokConfirmedAt:record.tiktokConfirmedAt||now}).where(owner);
    return Response.json({followConfirmed:true,tiktokConfirmed:true},{headers});
  }catch{return Response.json({error:"Konfirmasi belum tersimpan. Silakan coba lagi."},{status:503,headers});}
}
