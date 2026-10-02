"""Conferência do conteúdo dos PDFs fictícios reais (complementa a revisão visual)."""
import sys, re, json
from pathlib import Path
sys.path.insert(0, str(Path('tmp/pdf-tools').resolve()))
import pymupdf

folder = Path('output/pdf')
results = []
for path in sorted(folder.glob('*.pdf')):
    doc = pymupdf.open(path)
    text = ' '.join(' '.join(page.get_text().split()) for page in doc)
    for page in doc:
        assert abs(page.rect.width - 595.28) < 2 and abs(page.rect.height - 841.89) < 2, path
        assert len(page.get_text().strip()) > 80, (path, page.number, 'Página vazia')
        for word in page.get_text('words'):
            assert word[0] >= 30 and word[2] <= page.rect.width - 30, (path, page.number, word)
            assert word[1] >= 20 and word[3] <= page.rect.height - 5, (path, page.number, word)
    assert '127.0.0.1' not in text and 'NÃO IMPRIMIR PLACEHOLDER' not in text, path
    if 'filled' in path.name or 'imported' in path.name:
        repeats = 2 if 'imported' in path.name else 1
        paragraphs = [int(n) for n in re.findall(r'Registro (\d+):', text)]
        assert paragraphs == list(range(1, 66)) * repeats, (path, 'Parágrafos ausentes ou duplicados')
        assert text.count('FIM DA DESCRIÇÃO INTEGRAL.') == repeats, path
    if 'filled' in path.name:
        assert 'ÚLTIMO ITEM DO INVENTÁRIO' in text, path
        assert [int(n) for n in re.findall(r'Equipamento (\d+)', text)] == list(range(1, 43)), path
    if 'imported' in path.name:
        assert [int(n) for n in re.findall(r'Linha (\d+)', text)] == list(range(1, 71)), path
        assert 'FIM DO ITEM EXTENSO.' in text and 'd30' in text, path
        table_pages = [page.get_text() for page in doc if re.search(r'Linha \d+', page.get_text())]
        assert len(table_pages) > 1 and all('QUANTIDADE' in text.upper() for text in table_pages), 'Cabeçalho da tabela não repetiu'
    results.append({'file': path.name, 'pages': len(doc), 'content': 'passed', 'bounds': 'passed'})

dark = pymupdf.open(folder / 'imported-dark.pdf')
light = pymupdf.open(folder / 'imported-light.pdf')
assert len(dark) == len(light)
assert all(a.get_pixmap().samples == b.get_pixmap().samples for a, b in zip(dark, light)), 'Fundos/tema alteraram os pixels do documento'
report = {'pdfs': results, 'totalPages': sum(r['pages'] for r in results), 'lightDarkPixels': 'identical'}
(folder / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
