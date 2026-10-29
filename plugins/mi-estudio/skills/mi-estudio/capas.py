"""Capas editables en la línea de tiempo de Mi Estudio (pista "Capas").

Cada capa con tiempo de un plan.json (un título, una cita, un rótulo, un sticker, el cambio de título del CTA...)
pasa por aquí: el script del formato propone cuándo sale (from/to, en segundos del montaje) y, si el usuario la
movió, la estiró o la quitó en Mi Estudio, manda lo suyo. La capa queda pegada al momento de su toma (fragmento de
edl.json + segundo del clip), así que sigue en su sitio aunque cambien los cortes. save() reescribe timeline.json
con todas las capas para que la próxima vez la línea de tiempo las enseñe donde van.

    sys.path.insert(0, r'<MI>'); import capas
    L = capas.Capas(proj)                              # después de montar (lee edl.json, segments.json, timeline.json)
    r = L.timed('quote9', 'Cita 9', 17.6, 21.5)        # -> (from, to), o None si el usuario la quitó
    ...
    L.save()

Los ids tienen que ser estables entre versiones (p. ej. "pill10", "quote9", "wow"): es lo que une la capa con lo
que el usuario hizo con ella.
"""
import json
import os


class Capas:
    def __init__(self, proj):
        self.proj = proj
        J = lambda n, d: json.load(open(os.path.join(proj, n), encoding='utf-8')) if os.path.isfile(os.path.join(proj, n)) else d
        self.edl, self.segs = J('edl.json', []), J('segments.json', [])
        tl = J('timeline.json', {}) or {}
        self.effects = tl.get('effects') or []
        self.old = {e['id']: e for e in tl.get('elementos') or [] if isinstance(e, dict) and 'id' in e}
        self.out = []
        self.total = (self.segs[-1]['frame'] + self.segs[-1]['frames']) / 30 if self.segs else 0

    def _time(self, seg_id, src):
        """fragmento + segundo de su clip -> segundo del montaje (None si el fragmento ya no está)"""
        for e, s in zip(self.edl, self.segs):
            if e.get('id') == seg_id:              # un fragmento acelerado ("speed") dura menos que su trozo de clip
                return s['frame'] / 30 + min(max(src - e['in'], 0) / s.get('speed', 1), s['frames'] / 30)
        return None

    def _anchor(self, t):
        for k, (e, s) in enumerate(zip(self.edl, self.segs)):
            a, b = s['frame'] / 30, (s['frame'] + s['frames']) / 30
            if t < b - 1e-6 or k == len(self.segs) - 1:
                return {'seg': e['id'], 'src': round(e['in'] + max(0.0, t - a) * s.get('speed', 1), 3)}
        return None

    def timed(self, cid, label, frm, to):
        el = self.old.get(cid) or {}
        off, edited = bool(el.get('off')), bool(el.get('edited'))
        if edited:
            a = el.get('anchor') or {}
            t0 = self._time(a.get('seg'), a.get('src', 0)) if a else None
            if t0 is None:
                t0 = el.get('from', frm)
            frm, to = t0, t0 + max(0.1, el.get('to', to) - el.get('from', frm))
        frm, to = max(0.0, frm), min(self.total, max(to, frm + 0.1))
        self.out.append({'id': cid, 'label': label, 'from': round(frm, 3), 'to': round(to, 3),
                         'edited': edited, 'off': off, 'anchor': self._anchor(frm)})
        return None if off else (frm, to)

    def save(self):
        self.out.sort(key=lambda e: e['from'])
        json.dump({'effects': self.effects, 'elementos': self.out},
                  open(os.path.join(self.proj, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
