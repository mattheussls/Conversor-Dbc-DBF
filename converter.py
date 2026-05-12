from __future__ import annotations

import argparse
from pathlib import Path


class ConversionError(RuntimeError):
    pass


def _convert_with_dbctodbf(input_path: Path, output_path: Path) -> None:
    try:
        from dbctodbf import DBCDecompress
    except ImportError as exc:
        raise ConversionError(
            "A biblioteca 'dbc-to-dbf' nao esta instalada. Rode: pip install -r requirements.txt"
        ) from exc

    output_path.parent.mkdir(parents=True, exist_ok=True)
    converter = DBCDecompress()
    converter.decompressFile(str(input_path), str(output_path))


def convert_dbc_to_dbf(input_file: str | Path, output_file: str | Path | None = None) -> Path:
    input_path = Path(input_file).expanduser().resolve()
    if not input_path.exists():
        raise ConversionError(f"Arquivo nao encontrado: {input_path}")
    if not input_path.is_file():
        raise ConversionError(f"O caminho informado nao e um arquivo: {input_path}")
    if input_path.suffix.lower() != ".dbc":
        raise ConversionError("O arquivo de entrada precisa ter extensao .dbc")

    output_path = (
        Path(output_file).expanduser().resolve()
        if output_file
        else input_path.with_suffix(".dbf")
    )
    if output_path.suffix.lower() != ".dbf":
        output_path = output_path.with_suffix(".dbf")

    _convert_with_dbctodbf(input_path, output_path)

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise ConversionError("A conversao terminou, mas o DBF nao foi criado corretamente.")

    return output_path


def convert_folder(input_folder: str | Path, output_folder: str | Path | None = None) -> list[Path]:
    source = Path(input_folder).expanduser().resolve()
    if not source.is_dir():
        raise ConversionError(f"Pasta nao encontrada: {source}")

    destination = Path(output_folder).expanduser().resolve() if output_folder else source
    results: list[Path] = []
    for dbc_file in sorted(source.glob("*.dbc")):
        results.append(convert_dbc_to_dbf(dbc_file, destination / dbc_file.with_suffix(".dbf").name))

    if not results:
        raise ConversionError(f"Nenhum arquivo .dbc encontrado em: {source}")
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Converte arquivos DATASUS .dbc para .dbf")
    parser.add_argument("entrada", help="Arquivo .dbc ou pasta com arquivos .dbc")
    parser.add_argument("saida", nargs="?", help="Arquivo .dbf ou pasta de destino")
    parser.add_argument("--pasta", action="store_true", help="Converte todos os .dbc de uma pasta")
    args = parser.parse_args()

    try:
        entrada = Path(args.entrada)
        if args.pasta or entrada.is_dir():
            arquivos = convert_folder(entrada, args.saida)
            for arquivo in arquivos:
                print(f"OK: {arquivo}")
        else:
            arquivo = convert_dbc_to_dbf(entrada, args.saida)
            print(f"OK: {arquivo}")
    except ConversionError as exc:
        print(f"Erro: {exc}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
