"""Confere os seis PDFs reais dos perfis, inclusive o fallback do sistema importado."""
import sys, json, re
from pathlib import Path
sys.path.insert(0, str(Path('tmp/pdf-tools').resolve()))
import pymupdf

folder = Path('output/pdf/profiles')
report = []
for system in ['dnd2024', 'sistema-rpg', 'imported']:
    counts = {}
    for mode in ['full', 'compact']:
        path = folder / f'{system}-{mode}.pdf'
        doc = pymupdf.open(path)
        text = ' '.join(' '.join(page.get_text().split()) for page in doc)
        counts[mode] = len(doc)
        for page in doc:
            assert abs(page.rect.width - 595.28) < 2 and abs(page.rect.height - 841.89) < 2, path
            assert len(page.get_text().strip()) > 80, (path, page.number, 'Página vazia')
            assert all(w[0] >= 30 and w[2] <= page.rect.width - 30 and w[1] >= 20 and w[3] <= page.rect.height - 5 for w in page.get_text('words')), (path, page.number, 'Texto fora das margens')
        assert ('versão de consulta' in text) == (mode == 'compact'), path
        assert '127.0.0.1' not in text, path
        if system != 'imported':
            assert [int(n) for n in re.findall(r'Equipamento (\d+)', text)] == list(range(1, 43)), (path, 'Itens ausentes ou duplicados')
            assert ('FIM DA DESCRIÇÃO INTEGRAL.' in text) == (mode == 'full'), path
            if mode == 'full':
                assert [int(n) for n in re.findall(r'Registro (\d+):', text)] == list(range(1, 66)), path
            if system == 'dnd2024':
                assert 'Luz da jornada' in text and 'Truque' in text, path
                assert ('FIM DA MAGIA.' in text) == (mode == 'full'), path
            else:
                assert 'd12 + d6' in text and '7 / 16' in text and 'Energia paga: 2' in text, path
        else:
            assert 'Gerador' in text and 'Classe C' in text, path
            assert ('DETALHE COMPLETO' in text) == (mode == 'full'), path
            assert ('SEÇÃO OMITIDA' in text) == (mode == 'full'), path
            assert [int(n) for n in re.findall(r'Registro (\d+):', text)] == list(range(1, 66)), (path, 'Fallback perdeu conteúdo')
            assert 'FIM DA DESCRIÇÃO INTEGRAL.' in text, path
        report.append({'file': path.name, 'pages': len(doc), 'content': 'passed', 'bounds': 'passed'})
    if system != 'imported':
        assert counts['compact'] < counts['full'], system

result = {'pdfs': report, 'totalPages': sum(item['pages'] for item in report)}
(folder / 'verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
