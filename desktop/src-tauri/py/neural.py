# Vozes neurais do S.Y.N.A.P.S.E: lê pedidos JSON (1 por linha) no stdin, responde {"ok": wav} ou {"err": msg}
import sys, os, json
out, sys.stdout = sys.stdout, sys.stderr  # bibliotecas não poluem o protocolo
import soundfile as sf
D, E = os.path.dirname(os.path.abspath(__file__)), {}

def kokoro():
    from kokoro_onnx import Kokoro
    return Kokoro(os.path.join(D, 'kokoro-v1.0.onnx'), os.path.join(D, 'voices-v1.0.bin'))

def xtts():
    import torch
    from TTS.api import TTS
    return TTS('tts_models/multilingual/multi-dataset/xtts_v2').to('cuda' if torch.cuda.is_available() else 'cpu')

for line in sys.stdin:
    try:
        r = json.loads(line); e = r['engine']
        if e not in E: E[e] = {'kokoro': kokoro, 'xtts': xtts}[e]()
        if e == 'kokoro':
            a, sr = E[e].create(r['text'], voice=r['voice'], speed=r['speed'], lang='pt-br'); sf.write(r['out'], a, sr)
        else:
            E[e].tts_to_file(text=r['text'], speaker_wav=r['ref'], language='pt', file_path=r['out'], speed=r['speed'])
        print(json.dumps({'ok': r['out']}), file=out, flush=True)
    except Exception as x:
        print(json.dumps({'err': str(x)}), file=out, flush=True)
