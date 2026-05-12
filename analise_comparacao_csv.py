from __future__ import annotations

from collections import Counter
from pathlib import Path

import pandas as pd


CORRETO = Path("analise_csv_papa/BELEM_PAPA2601_204956.csv")
GERADO = Path("analise_csv_papa/BELEM_PAPA2601.csv")
COLUMNS = ["PA_CODUNI", "PA_CNPJMNT", "PA_PROC_ID", "PA_QTDPRO", "PA_QTDAPR", "PA_VALPRO", "PA_VALAPR"]


def load_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, sep=";", dtype=str, encoding="utf-8-sig")


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()
    for column in ["PA_CODUNI", "PA_CNPJMNT", "PA_PROC_ID"]:
        normalized[column] = normalized[column].astype(str).str.strip()
    for column in ["PA_QTDPRO", "PA_QTDAPR"]:
        normalized[column] = pd.to_numeric(normalized[column], errors="coerce").fillna(0).astype("int64").astype(str)
    for column in ["PA_VALPRO", "PA_VALAPR"]:
        normalized[column] = pd.to_numeric(normalized[column], errors="coerce").fillna(0).map(lambda value: f"{value:.2f}")
    return normalized[COLUMNS]


def print_summary(name: str, df: pd.DataFrame) -> None:
    numeric = df.copy()
    for column in ["PA_QTDPRO", "PA_QTDAPR", "PA_VALPRO", "PA_VALAPR"]:
        numeric[column] = pd.to_numeric(numeric[column], errors="coerce").fillna(0)

    print(f"\n{name}")
    print(f"linhas: {len(df)}")
    print(f"colunas: {list(df.columns)}")
    print(f"soma PA_QTDPRO: {int(numeric['PA_QTDPRO'].sum())}")
    print(f"soma PA_QTDAPR: {int(numeric['PA_QTDAPR'].sum())}")
    print(f"soma PA_VALPRO: {numeric['PA_VALPRO'].sum():.2f}")
    print(f"soma PA_VALAPR: {numeric['PA_VALAPR'].sum():.2f}")
    print(f"unidades distintas: {df['PA_CODUNI'].nunique()}")
    print(f"procedimentos distintos: {df['PA_PROC_ID'].nunique()}")
    print("top 5 PA_CODUNI:")
    print(df["PA_CODUNI"].value_counts().head(5).to_string())


def main() -> None:
    correto = load_csv(CORRETO)
    gerado = load_csv(GERADO)

    print_summary("CORRETO", correto)
    print_summary("GERADO", gerado)

    print("\nprimeiras linhas CORRETO:")
    print(correto.head(5).to_string(index=False))
    print("\nprimeiras linhas GERADO:")
    print(gerado.head(5).to_string(index=False))

    correto_norm = normalize(correto)
    gerado_norm = normalize(gerado)

    correto_keys = correto_norm.agg("\x1f".join, axis=1)
    gerado_keys = gerado_norm.agg("\x1f".join, axis=1)
    correto_counter = Counter(correto_keys)
    gerado_counter = Counter(gerado_keys)

    faltando_no_gerado = correto_counter - gerado_counter
    sobrando_no_gerado = gerado_counter - correto_counter

    print("\ncomparacao ignorando ordem:")
    print(f"conteudo igual: {not faltando_no_gerado and not sobrando_no_gerado}")
    print(f"tipos de linha faltando no gerado: {len(faltando_no_gerado)}")
    print(f"total de linhas faltando no gerado: {sum(faltando_no_gerado.values())}")
    print(f"tipos de linha sobrando no gerado: {len(sobrando_no_gerado)}")
    print(f"total de linhas sobrando no gerado: {sum(sobrando_no_gerado.values())}")

    print("\nexemplos faltando no gerado:")
    for key, count in list(faltando_no_gerado.items())[:10]:
        print(count, key.replace("\x1f", ";"))

    print("\nexemplos sobrando no gerado:")
    for key, count in list(sobrando_no_gerado.items())[:10]:
        print(count, key.replace("\x1f", ";"))

    correto_sorted = correto_norm.sort_values(COLUMNS, kind="mergesort").reset_index(drop=True)
    gerado_sorted = gerado_norm.sort_values(COLUMNS, kind="mergesort").reset_index(drop=True)
    print(f"\niguais apos ordenar e normalizar: {correto_sorted.equals(gerado_sorted)}")


if __name__ == "__main__":
    main()
