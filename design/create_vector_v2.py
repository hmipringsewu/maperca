from pathlib import Path
from PIL import Image, ImageDraw
OUT=Path(__file__).parent
W,H,S=1600,600,3
im=Image.new('RGBA',(W*S,H*S)); d=ImageDraw.Draw(im); paths=[]
def polygon(points,color):
    paths.append('<path fill="'+color+'" d="M'+' L'.join(f'{x},{y}' for x,y in points)+'Z"/>')
    d.polygon([(round(x*S),round(y*S)) for x,y in points],fill=color)
def rect(x,y,w,h,color,shear=0):
    polygon([(x,y),(x+w,y),(x+w-shear*h,y+h),(x-shear*h,y+h)],color)
polygon([(167,102),(534,102),(534,87),(1030,87),(1030,99),(1455,99),(1455,361),(1425,361),(1425,413),(158,413),(158,371),(128,371),(128,154),(167,154)],'#080D0B')
polygon([(184,102),(534,102),(534,87),(1030,87),(1030,99),(1455,99),(1455,123),(184,123)],'#123B28')
glyphs={
'M':['1100011','1110111','1111111','1101011','1100011','1100011','1100011'],
'A':['0111110','1111111','1100011','1111111','1111111','1100011','1100011'],
'P':['1111110','1111111','1100011','1111111','1111110','1100000','1100000'],
'E':['1111111','1111111','1100000','1111110','1100000','1111111','1111111'],
'R':['1111110','1111111','1100011','1111110','1111000','1101100','1100111'],
'C':['0111111','1111111','1100000','1100000','1100000','1111111','0111111']}
ux,uy=22,31
start=(W-55*ux)/2
for k,ch in enumerate('MAPERCA'):
    y0=144+[0,-6,2,-3,4,-2,1][k]
    for row,line in enumerate(glyphs[ch]):
        # Solid connected horizontal runs keep glyphs bold like the reference.
        pos=0
        while pos<len(line):
            if line[pos]=='0':pos+=1;continue
            end=pos
            while end<len(line) and line[end]=='1':end+=1
            ratio=row/6
            rgb=tuple(round(a+(b-a)*ratio) for a,b in zip((41,216,100),(0,155,75)))
            color='#%02x%02x%02x'%rgb
            rect(start+k*8*ux+pos*ux-row*uy*.065,y0+row*uy,(end-pos)*ux,uy,color,.065)
            pos=end
small={
'M':['10001','11011','10101','10101','10001','10001','10001'],
'P':['11110','10001','10001','11110','10000','10000','10000'],
'C':['01111','10000','10000','10000','10000','10000','01111'],
'A':['01110','10001','10001','11111','10001','10001','10001'],
'a':['00000','00000','01110','00001','01111','10001','01111'],
's':['00000','00000','01111','10000','01110','00001','11110'],
'e':['00000','00000','01110','10001','11111','10000','01111'],
'n':['00000','00000','11110','10001','10001','10001','10001'],
'g':['00000','01111','10001','10001','01111','00001','01110'],
'l':['11000','01000','01000','01000','01000','01000','00110'],
'o':['00000','00000','01110','10001','10001','10001','01110'],
't':['01000','01000','11110','01000','01000','01001','00110'],
' ':['000']*7}
text='Masa Pengenalan Calon Anggota'
u=7
width=sum((len(small[c][0])+1)*u for c in text)-u
x=(W-width)/2
for ch in text:
    for row,line in enumerate(small[ch]):
        for col,bit in enumerate(line):
            if bit=='1':rect(x+col*u,447+row*u,u,u,'#FFFFFF')
    x+=(len(small[ch][0])+1)*u
svg='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600" viewBox="0 0 1600 600"><title>MAPERCA — Masa Pengenalan Calon Anggota</title><g transform="rotate(-2 800 300)">'+''.join(paths)+'</g></svg>'
(OUT/'maperca-hijau-hitam-v2.svg').write_text(svg,encoding='utf-8')
im=im.rotate(2,resample=Image.Resampling.BICUBIC,center=(800*S,300*S)).resize((W,H),Image.Resampling.LANCZOS)
im.save(OUT/'maperca-hijau-hitam-v2.png')
print('Saved SVG and transparent PNG')
