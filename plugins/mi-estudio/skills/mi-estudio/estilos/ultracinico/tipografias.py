"""Ultracinico type sheet: the H1 (Barlow), the H2 and the subtitles (DM Serif) over frames of his footage,
with sliders to size them live. Save writes the sizes into this style's style.json.

  PY tipografias.py        prints STATUS tipos READY <url>, STATUS tipos SAVED <sizes> on each save; Ctrl+C to stop
                           (--until-saved: stops after the first save)
"""
import json
import os
import re
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = os.path.join(HERE, 'style.json')
ST = os.path.dirname(os.path.dirname(HERE))
plat = json.load(open(os.path.join(ST, '.platform.json'), encoding='utf-8'))
FONT_DIRS = [os.path.join(ST, 'fonts'), os.path.join(plat['skill_dir'], 'engine', 'fonts')]
UNTIL_SAVED = '--until-saved' in sys.argv


def rule_px(css, cls, prop):
    m = re.search(r'%s\{[^}]*?%s:(\d+)px' % (re.escape(cls), prop), css)
    return int(m.group(1)) if m else None


def sizes():
    s = json.load(open(STYLE, encoding='utf-8'))
    return {'title': rule_px(s['css'], '.cine-title', 'font-size') or 112,
            'width': rule_px(s['css'], '.cine-title .ln', 'max-width') or 760,
            'apoyo': rule_px(s['css'], '.cine-h2', 'font-size') or 100,
            'sub': s['caption'].get('size', 64)}


def save(v):
    s = json.load(open(STYLE, encoding='utf-8'))
    css = s['css']
    for cls, prop, val in (('.cine-title', 'font-size', v['title']), ('.cine-title .ln', 'max-width', v['width']),
                           ('.cine-h2', 'font-size', v['apoyo'])):
        css = re.sub(r'(%s\{[^}]*?%s:)\d+px' % (re.escape(cls), prop), r'\g<1>%dpx' % val, css, count=1)
    s['css'] = css
    s['caption']['size'] = v['sub']
    s['caption']['chars'] = max(12, round(26 * 64 / v['sub']))   # 26 characters a line at 64 px
    json.dump(s, open(STYLE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


PAGE = r"""<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ultracinico: tipografías</title>
<style>
@font-face{font-family:'Barlow Condensed';font-weight:800;src:url('/fonts/BarlowCondensed-800-normal.woff2')}
@font-face{font-family:'DM Serif Display';font-weight:400;font-style:normal;src:url('/fonts/DMSerifDisplay-400-normal.woff2')}
@font-face{font-family:'DM Serif Display';font-weight:400;font-style:italic;src:url('/fonts/DMSerifDisplay-400-italic.woff2')}
body{margin:0;background:#111;color:#eee;font:15px system-ui;display:flex;gap:28px;padding:16px;height:100vh;box-sizing:border-box}
#wrap{position:relative;flex:none}
#stage{position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:0 0;background:#222 center/cover;overflow:hidden}
#safe{position:absolute;inset:220px 35px 450px 35px;outline:2px dashed rgba(255,60,60,.7);pointer-events:none}
[contenteditable]{outline:none;cursor:text}
%(css)s
.sub{position:absolute;left:35px;width:1010px;top:1250px;text-align:center;font-family:'DM Serif Display';font-weight:400;
  color:#FFF238;line-height:1.1;text-shadow:%(shadow)s}
.sub i{font-style:italic}
#side{width:330px;overflow:auto}
.ctl{margin:16px 0}.ctl b{display:flex;justify-content:space-between}.ctl b span{color:#f5c518;font-family:ui-monospace,monospace}
input[type=range]{width:100%%}
button{font:inherit;padding:10px 18px;border-radius:8px;border:0;background:#f5c518;color:#111;font-weight:700;cursor:pointer}
.seg button{background:#333;color:#eee;padding:6px 12px}.seg button.on{background:#f5c518;color:#111}
label{display:block;margin:6px 0}
</style></head><body>
<div id="wrap"><div id="stage">
  <div id="g" class="cine-grad"></div>
  <div id="t" class="cine-title" style="top:330px"><span class="ln" contenteditable>Las 7 mejores pelis que seguramente no conoces</span></div>
  <div id="a" class="cine-h2" style="top:236px" contenteditable>esta peli es <span class="r">muy</span> infravalorada</div>
  <div id="s" class="sub" contenteditable>tienes que ver <i>Oldboy</i></div>
  <div id="safe"></div>
</div></div>
<div id="side">
<h2 style="margin-top:0">Ultracinico · tipografías</h2>
<p style="color:#aaa">Los textos se pueden editar haciendo clic. La línea roja es la zona segura de Reels.</p>
<div class="ctl"><b>Título (Barlow) <span id="vt"></span></b><input type="range" id="title" min="60" max="200"></div>
<div class="ctl"><b>Ancho máx. del título <span id="vw"></span></b><input type="range" id="width" min="500" max="1010"></div>
<div class="ctl"><b>Subtítulos (DM Serif) <span id="vs"></span></b><input type="range" id="sub" min="36" max="120"></div>
<div class="ctl"><b>H2 (DM Serif neón) <span id="va"></span></b><input type="range" id="apoyo" min="50" max="180"></div>
<div class="ctl seg">Color del título: <button data-c="y" class="on">Amarillo</button> <button data-c="w">Blanco</button></div>
<label><input type="checkbox" id="shg" checked> Degradado negro del título</label>
<label><input type="checkbox" id="sha" checked> H2</label>
<label><input type="checkbox" id="shs" checked> Subtítulos</label>
<div class="ctl">Fondo: <input type="range" id="fr" min="1" max="3" value="1" style="width:120px"></div>
<p><button id="save">Guardar en el estilo</button></p><p id="msg" style="color:#8f8"></p>
<p style="color:#888">Guarda los cuatro valores de tamaño. El color, los textos y las casillas son solo para la prueba.</p>
</div>
<script>
let v=%(sizes)s; const st=document.getElementById('stage'), wrap=document.getElementById('wrap');
function fit(){const sc=Math.min((innerHeight-32)/1920,(innerWidth-400)/1080,1);st.style.transform='scale('+sc+')';wrap.style.width=1080*sc+'px';wrap.style.height=1920*sc+'px'}
function draw(){const t=document.getElementById('t');t.style.fontSize=v.title+'px';t.querySelector('.ln').style.maxWidth=v.width+'px';
  document.getElementById('s').style.fontSize=v.sub+'px';document.getElementById('a').style.fontSize=v.apoyo+'px';
  for(const k of ['title','width','sub','apoyo'])document.getElementById(k).value=v[k];
  document.getElementById('vt').textContent=v.title+' px';document.getElementById('vw').textContent=v.width+' px';
  document.getElementById('vs').textContent=v.sub+' px';document.getElementById('va').textContent=v.apoyo+' px'}
for(const k of ['title','width','sub','apoyo'])document.getElementById(k).oninput=e=>{v[k]=+e.target.value;draw()};
document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.seg button').forEach(x=>x.classList.toggle('on',x==b));
  document.getElementById('t').classList.toggle('y',b.dataset.c=='y')});
const show=(id,el)=>document.getElementById(id).onchange=e=>document.getElementById(el).style.display=e.target.checked?'':'none';
show('shg','g');show('sha','a');show('shs','s');
const fr=document.getElementById('fr');fr.oninput=()=>st.style.backgroundImage='url(/preview/frame'+fr.value+'.jpg)';fr.oninput();
document.getElementById('save').onclick=async()=>{const r=await fetch('/save',{method:'POST',body:JSON.stringify(v)});
  document.getElementById('msg').textContent=r.ok?'Guardado en Ultracinico: título '+v.title+' px, ancho '+v.width+' px, subtítulos '+v.sub+' px, H2 '+v.apoyo+' px.':'Error al guardar'};
addEventListener('resize',fit);fit();draw();
</script></body></html>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, body, ctype):
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = self.path.split('?')[0]
        if p == '/':
            s = json.load(open(STYLE, encoding='utf-8'))
            css = re.sub(r"@font-face\{[^}]*\}", '', s['css'])       # the page loads the fonts itself
            html = PAGE % {'css': css, 'shadow': s['caption'].get('shadow', 'none'),
                           'sizes': json.dumps(sizes())}
            return self.send(html.encode('utf-8'), 'text/html; charset=utf-8')
        name = os.path.basename(p)
        if p.startswith('/fonts/'):
            for d in FONT_DIRS:
                if os.path.isfile(os.path.join(d, name)):
                    return self.send(open(os.path.join(d, name), 'rb').read(), 'font/woff2')
        if p.startswith('/preview/') and os.path.isfile(os.path.join(HERE, 'preview', name)):
            return self.send(open(os.path.join(HERE, 'preview', name), 'rb').read(), 'image/jpeg')
        self.send_error(404)

    def do_POST(self):
        if self.path != '/save':
            return self.send_error(404)
        v = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        v = {k: int(v[k]) for k in ('title', 'width', 'sub', 'apoyo')}
        save(v)
        self.send(b'ok', 'text/plain')
        print('STATUS tipos SAVED', json.dumps(v), flush=True)
        self.server.saved = True


srv = ThreadingHTTPServer(('127.0.0.1', 4851), H)
srv.saved = False
url = 'http://127.0.0.1:4851/'
print('STATUS tipos READY', url, flush=True)
webbrowser.open(url)
while not (UNTIL_SAVED and srv.saved):
    srv.handle_request()
