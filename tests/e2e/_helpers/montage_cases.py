import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
mod = sys.argv[1]; src = f"tests/e2e/screenshots/cases/{mod}"
status = {}  # MC-id -> 'pass'/'fail'/'skip' optional via arg file
files = sorted(glob.glob(f"{src}/MC-*.png"))
# only the canonical per-case (skip -member variants for grid)
files = [f for f in files if '-member' not in f]
cols, tw, pad, lh = 5, 360, 8, 22
rows = (len(files)+cols-1)//cols
def thumb(f):
    im = Image.open(f).convert("RGB"); w,h = im.size
    th = int(tw*h/w); im = im.resize((tw,th)); return im
ths = [(os.path.basename(f)[:-4], thumb(f)) for f in files]
cellh = max(t.size[1] for _,t in ths)+lh
W = cols*tw + (cols+1)*pad
H = rows*(cellh+pad)+pad
canvas = Image.new("RGB",(W,H),(245,246,248))
d = ImageDraw.Draw(canvas)
try: font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 15)
except: font = ImageFont.load_default()
for i,(name,t) in enumerate(ths):
    r,c = divmod(i,cols)
    x = pad + c*(tw+pad); y = pad + r*(cellh+pad)
    d.rectangle([x,y,x+tw,y+lh-2], fill=(30,40,55))
    d.text((x+6,y+3), name, fill=(255,255,255), font=font)
    canvas.paste(t,(x,y+lh))
out = f"tests/e2e/screenshots/cases/_montage_{mod}.png"
canvas.save(out, optimize=True)
print(out, canvas.size, f"{os.path.getsize(out)//1024}KB", f"{len(ths)} miniatur")
