from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from PIL import Image, ImageDraw, ImageFont
import html

OUT = Path(__file__).parent
W,H = 1600,640
S=3
im=Image.new('RGBA',(W*S,H*S),(0,0,0,0))
draw=ImageDraw.Draw(im)
parts=[]
def poly(points,fill):
    parts.append('<polygon points="'+' '.join(f'{x},{y}' for x,y in points)+f'" fill="{fill}"/>')
    draw.polygon([(int(x*S),int(y*S)) for x,y in points],fill=fill)
def rect(x,y,w,h,fill):
    parts.append(f'<path d="M{x} {y}h{w}v{h}h-{w}Z" fill="{fill}"/>')
    draw.rectangle((int(x*S),int(y*S),int((x+w)*S)-1,int((y+h)*S)-1),fill=fill)

poly([(116,123),(1432,123),(1432,426),(116,426)],'#006C37')
poly([(143,91),(1460,91),(1460,401),(143,401)],'#101413')
rect(143,91,240,12,'#009B4C')
rect(1218,389,242,12,'#009B4C')
letters={
'M':['10001','11011','10101','10101','10001','10001','10001'],
'A':['01110','11011','10001','11111','10001','10001','10001'],
'P':['11110','10001','10001','11110','10000','10000','10000'],
'E':['11111','10000','10000','11110','10000','10000','11111'],
'R':['11110','10001','10001','11110','10100','10010','10001'],
'C':['01111','11000','10000','10000','10000','11000','01111']}
unit=29
x0=(W-41*unit)/2
for offset,color in [(7,'#004D29'),(0,'#00A651')]:
    for k,ch in enumerate('MAPERCA'):
        for row,bits in enumerate(letters[ch]):
            for col,bit in enumerate(bits):
                if bit=='1':rect(x0+(k*6+col)*unit+offset,147+row*unit+offset,unit,unit,color)

poly([(232,424),(1370,424),(1370,513),(232,513)],'#101413')
rect(232,513,1138,7,'#009B4C')
text='MASA PENGENALAN CALON ANGGOTA'
fontfile='C:/Windows/Fonts/arialbd.ttf'
font=TTFont(fontfile)
glyphset=font.getGlyphSet(); cmap=font.getBestCmap(); upm=font['head'].unitsPerEm
size=45
adv=sum(font['hmtx'][cmap[ord(c)]][0] for c in text)
scale=size/upm
start=(W-adv*scale)/2
pen=SVGPathPen(glyphset)
paths=[];cursor=0
for c in text:
    name=cmap[ord(c)]
    p=SVGPathPen(glyphset);glyphset[name].draw(p)
    paths.append(f'<path transform="translate({cursor} 0)" d="{p.getCommands()}"/>')
    cursor+=font['hmtx'][name][0]
parts.append(f'<g fill="#FFFFFF" transform="translate({start:.4f} 483) scale({scale:.8f} {-scale:.8f})">'+''.join(paths)+'</g>')
pfont=ImageFont.truetype(fontfile,round(size*S))
draw.text((round(start*S),483*S),text,font=pfont,fill='white',anchor='ls')
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="640" viewBox="0 0 1600 640" role="img" aria-labelledby="title desc">
<title id="title">MAPERCA — Masa Pengenalan Calon Anggota</title>
<desc id="desc">Tipografi blok hijau dan hitam, latar transparan. Semua huruf berupa path vektor.</desc>
<g transform="rotate(-2 800 320)">{''.join(parts)}</g></svg>'''
(OUT/'maperca-hijau-hitam.svg').write_text(svg,encoding='utf-8')
im=im.rotate(2,resample=Image.Resampling.BICUBIC,center=(800*S,320*S))
im=im.resize((W,H),Image.Resampling.LANCZOS)
im.save(OUT/'maperca-hijau-hitam.png')
print(OUT.resolve()/'maperca-hijau-hitam.svg')
