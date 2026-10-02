"""Renderização local de QA; não integra a aplicação nem suas dependências."""
import sys, json, re
from pathlib import Path
sys.path.insert(0, str(Path('tmp/pdf-tools').resolve()))
import pymupdf as fitz
from PIL import Image, ImageDraw

folder = Path(sys.argv[1])
report = []
for path in sorted(folder.glob('*.pdf')):
    pdf = fitz.open(path)
    out = folder / path.stem
    out.mkdir(exist_ok=True)
    # Somente páginas/contatos excedentes gerados pelo próprio script.
    for old in out.iterdir():
        match = re.fullmatch(r'(page|contact)-(\d+)\.(png|jpg)', old.name)
        if match and int(match[2]) > (len(pdf) if match[1] == 'page' else (len(pdf) + 5) // 6):
            old.unlink()
    pages = []
    all_text = ''
    for index, page in enumerate(pdf):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25))
        pix.save(str(out / f'page-{index + 1:02}.png'))
        text = page.get_text()
        all_text += text
        bounds = [list(b[:4]) for b in page.get_text('blocks') if b[4].strip()]
        pages.append({'page': index + 1, 'chars': len(text), 'bounds': bounds})
    (out / 'text.txt').write_text(all_text, encoding='utf-8')
    for start in range(0, len(pdf), 6):
        canvas = Image.new('RGB', (1260, 960), '#bbb')
        draw = ImageDraw.Draw(canvas)
        for index in range(start, min(start + 6, len(pdf))):
            img = Image.open(out / f'page-{index + 1:02}.png').convert('RGB')
            img.thumbnail((410, 440))
            x, y = ((index-start) % 3)*420, ((index-start)//3)*480
            canvas.paste(img, (x, y+25))
            draw.text((x+10, y+5), f'{path.stem} / {index+1}', fill='black')
        canvas.save(out / f'contact-{start//6+1}.jpg')
    normalized = ' '.join(all_text.split())
    report.append({'file': path.name, 'pages': len(pdf), 'details': pages, 'longTextEnd': 'FIM DA DESCRIÇÃO INTEGRAL.' in normalized, 'lastItem': 'ÚLTIMO ITEM DO INVENTÁRIO' in normalized, 'longItemEnd': 'FIM DO ITEM EXTENSO.' in normalized})
(folder / 'pdf-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps([{k:v for k,v in r.items() if k != 'details'} for r in report], ensure_ascii=False, indent=2))
