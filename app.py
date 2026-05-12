from __future__ import annotations

import os
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from converter import ConversionError, convert_dbc_to_dbf, convert_folder


WINDOW_BG = "#f4f7fb"
PANEL_BG = "#ffffff"
INK = "#172033"
MUTED = "#5d6b82"
PRIMARY = "#146c94"
PRIMARY_DARK = "#0f5575"
ACCENT = "#21867a"
BORDER = "#d9e2ec"
SOFT = "#edf3f8"
ERROR = "#b42318"


class DbcConverterApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Conversor DBC para DBF")
        self.geometry("840x560")
        self.minsize(760, 500)
        self.configure(bg=WINDOW_BG)

        self.mode_var = tk.StringVar(value="file")
        self.input_var = tk.StringVar()
        self.output_var = tk.StringVar()
        self.status_var = tk.StringVar(value="Pronto para converter.")
        self.detail_var = tk.StringVar(value="Escolha um arquivo .dbc ou uma pasta com arquivos .dbc.")
        self.last_output_folder: Path | None = None

        self._configure_style()
        self._build_ui()

    def _configure_style(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")

        self.option_add("*Font", ("Segoe UI", 10))
        style.configure(".", font=("Segoe UI", 10), background=WINDOW_BG, foreground=INK)
        style.configure("Header.TFrame", background=PRIMARY)
        style.configure("HeaderTitle.TLabel", background=PRIMARY, foreground="#ffffff", font=("Segoe UI", 22, "bold"))
        style.configure("HeaderText.TLabel", background=PRIMARY, foreground="#d8eef8", font=("Segoe UI", 10))
        style.configure("Panel.TFrame", background=PANEL_BG, relief="flat")
        style.configure("Soft.TFrame", background=SOFT)
        style.configure("Title.TLabel", background=PANEL_BG, foreground=INK, font=("Segoe UI", 13, "bold"))
        style.configure("Text.TLabel", background=PANEL_BG, foreground=MUTED)
        style.configure("SoftText.TLabel", background=SOFT, foreground=MUTED)
        style.configure("Status.TLabel", background=PANEL_BG, foreground=INK, font=("Segoe UI", 11, "bold"))
        style.configure("Danger.TLabel", background=PANEL_BG, foreground=ERROR)
        style.configure("TEntry", fieldbackground="#ffffff", bordercolor=BORDER, lightcolor=BORDER, darkcolor=BORDER, padding=8)
        style.configure("Primary.TButton", background=PRIMARY, foreground="#ffffff", padding=(18, 10), font=("Segoe UI", 10, "bold"))
        style.map("Primary.TButton", background=[("active", PRIMARY_DARK), ("disabled", "#9fb8c6")])
        style.configure("Accent.TButton", background=ACCENT, foreground="#ffffff", padding=(14, 9), font=("Segoe UI", 10, "bold"))
        style.map("Accent.TButton", background=[("active", "#176b61"), ("disabled", "#9ebbb7")])
        style.configure("Ghost.TButton", background=SOFT, foreground=INK, padding=(12, 8), bordercolor=BORDER)
        style.map("Ghost.TButton", background=[("active", "#e3edf5")])
        style.configure("Mode.TRadiobutton", background=PANEL_BG, foreground=INK, font=("Segoe UI", 10, "bold"))
        style.configure("Horizontal.TProgressbar", background=ACCENT, troughcolor="#dbe8ef", bordercolor="#dbe8ef")

    def _build_ui(self) -> None:
        self._build_header()

        content = ttk.Frame(self, style="Panel.TFrame", padding=22)
        content.pack(fill="both", expand=True, padx=22, pady=22)

        top = ttk.Frame(content, style="Panel.TFrame")
        top.pack(fill="x")

        ttk.Label(top, text="O que deseja converter?", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            top,
            text="Use arquivo unico para uma conversao pontual, ou pasta inteira para processar varios DBC de uma vez.",
            style="Text.TLabel",
        ).pack(anchor="w", pady=(3, 12))

        mode_row = ttk.Frame(top, style="Panel.TFrame")
        mode_row.pack(fill="x", pady=(0, 14))
        ttk.Radiobutton(
            mode_row,
            text="Arquivo unico",
            value="file",
            variable=self.mode_var,
            command=self._mode_changed,
            style="Mode.TRadiobutton",
        ).pack(side="left")
        ttk.Radiobutton(
            mode_row,
            text="Pasta inteira",
            value="folder",
            variable=self.mode_var,
            command=self._mode_changed,
            style="Mode.TRadiobutton",
        ).pack(side="left", padx=(28, 0))

        self._path_row(content, "Entrada", self.input_var, self._choose_input)
        self._path_row(content, "Destino", self.output_var, self._choose_output)

        action_row = ttk.Frame(content, style="Panel.TFrame")
        action_row.pack(fill="x", pady=(18, 12))
        self.convert_button = ttk.Button(
            action_row,
            text="Converter agora",
            command=self._start_conversion,
            style="Primary.TButton",
        )
        self.convert_button.pack(side="left")
        ttk.Button(action_row, text="Limpar", command=self._clear_paths, style="Ghost.TButton").pack(side="left", padx=10)
        self.open_folder_button = ttk.Button(
            action_row,
            text="Abrir pasta de destino",
            command=self._open_output_folder,
            style="Accent.TButton",
            state="disabled",
        )
        self.open_folder_button.pack(side="right")

        self.progress = ttk.Progressbar(content, mode="indeterminate")
        self.progress.pack(fill="x", pady=(2, 14))

        status_panel = ttk.Frame(content, style="Soft.TFrame", padding=16)
        status_panel.pack(fill="both", expand=True)
        ttk.Label(status_panel, textvariable=self.status_var, style="Status.TLabel", background=SOFT).pack(anchor="w")
        ttk.Label(
            status_panel,
            textvariable=self.detail_var,
            style="SoftText.TLabel",
            wraplength=740,
            justify="left",
        ).pack(anchor="w", pady=(5, 12), fill="x")

        self.result_list = tk.Listbox(
            status_panel,
            height=6,
            bg="#ffffff",
            fg=INK,
            selectbackground=PRIMARY,
            selectforeground="#ffffff",
            relief="flat",
            highlightthickness=1,
            highlightbackground=BORDER,
            font=("Segoe UI", 9),
        )
        self.result_list.pack(fill="both", expand=True)

    def _build_header(self) -> None:
        header = ttk.Frame(self, style="Header.TFrame", padding=(24, 20))
        header.pack(fill="x")
        ttk.Label(header, text="Conversor DBC para DBF", style="HeaderTitle.TLabel").pack(anchor="w")
        ttk.Label(
            header,
            text="Transforme arquivos compactados do DATASUS em DBF com poucos cliques.",
            style="HeaderText.TLabel",
        ).pack(anchor="w", pady=(4, 0))

    def _path_row(self, parent: ttk.Frame, label: str, variable: tk.StringVar, command) -> None:
        row = ttk.Frame(parent, style="Panel.TFrame")
        row.pack(fill="x", pady=7)
        ttk.Label(row, text=label, width=10, style="Title.TLabel").pack(side="left")
        ttk.Entry(row, textvariable=variable).pack(side="left", fill="x", expand=True, padx=(8, 10))
        ttk.Button(row, text="Escolher", command=command, style="Ghost.TButton").pack(side="left")

    def _choose_input(self) -> None:
        if self._is_folder_mode():
            path = filedialog.askdirectory(title="Selecione a pasta com arquivos DBC")
        else:
            path = filedialog.askopenfilename(
                title="Selecione o arquivo DBC",
                filetypes=[("Arquivos DBC", "*.dbc"), ("Todos os arquivos", "*.*")],
            )
        if path:
            self.input_var.set(path)
            self._suggest_output(path)
            self._show_ready_message()

    def _choose_output(self) -> None:
        if self._is_folder_mode():
            path = filedialog.askdirectory(title="Selecione a pasta de destino")
        else:
            initial = Path(self.input_var.get()).with_suffix(".dbf") if self.input_var.get() else None
            path = filedialog.asksaveasfilename(
                title="Salvar DBF como",
                defaultextension=".dbf",
                initialfile=initial.name if initial else "",
                filetypes=[("Arquivos DBF", "*.dbf"), ("Todos os arquivos", "*.*")],
            )
        if path:
            self.output_var.set(path)
            self._show_ready_message()

    def _suggest_output(self, input_path: str) -> None:
        path = Path(input_path)
        if self._is_folder_mode():
            self.output_var.set(str(path))
        else:
            self.output_var.set(str(path.with_suffix(".dbf")))

    def _mode_changed(self) -> None:
        self._clear_paths()
        if self._is_folder_mode():
            self.detail_var.set("Selecione uma pasta de entrada. Cada arquivo .dbc encontrado nela sera convertido.")
        else:
            self.detail_var.set("Selecione um arquivo .dbc. O destino .dbf sera sugerido automaticamente.")

    def _clear_paths(self) -> None:
        self.input_var.set("")
        self.output_var.set("")
        self.last_output_folder = None
        self.open_folder_button.config(state="disabled")
        self.status_var.set("Pronto para converter.")
        self.detail_var.set("Escolha um arquivo .dbc ou uma pasta com arquivos .dbc.")
        self.result_list.delete(0, tk.END)

    def _show_ready_message(self) -> None:
        if self.input_var.get() and self.output_var.get():
            self.status_var.set("Tudo certo para iniciar.")
            self.detail_var.set("Confira entrada e destino. Depois clique em Converter agora.")

    def _start_conversion(self) -> None:
        input_path = self.input_var.get().strip()
        output_path = self.output_var.get().strip() or None
        folder_mode = self._is_folder_mode()
        if not input_path:
            messagebox.showwarning("Entrada obrigatoria", "Selecione um arquivo DBC ou uma pasta de entrada.")
            return

        self.result_list.delete(0, tk.END)
        self.open_folder_button.config(state="disabled")
        self.convert_button.config(state="disabled")
        self.progress.start(12)
        self.status_var.set("Convertendo...")
        self.detail_var.set("Aguarde enquanto o arquivo e descompactado e salvo em DBF.")

        thread = threading.Thread(
            target=self._convert,
            args=(input_path, output_path, folder_mode),
            daemon=True,
        )
        thread.start()

    def _convert(self, input_path: str, output_path: str | None, folder_mode: bool) -> None:
        try:
            if folder_mode:
                results = convert_folder(input_path, output_path)
                output_folder = Path(output_path).resolve() if output_path else Path(input_path).resolve()
                message = f"Conversao concluida: {len(results)} arquivo(s) DBF gerado(s)."
            else:
                result = convert_dbc_to_dbf(input_path, output_path)
                results = [result]
                output_folder = result.parent
                message = "Conversao concluida com sucesso."
            self.after(0, self._finish_success, message, results, output_folder)
        except ConversionError as exc:
            self.after(0, self._finish_error, str(exc))
        except Exception as exc:  # noqa: BLE001
            self.after(0, self._finish_error, f"Erro inesperado: {exc}")

    def _finish_success(self, message: str, results: list[Path], output_folder: Path) -> None:
        self.progress.stop()
        self.convert_button.config(state="normal")
        self.open_folder_button.config(state="normal")
        self.last_output_folder = output_folder
        self.status_var.set(message)
        self.detail_var.set(f"Arquivos salvos em: {output_folder}")
        for result in results:
            self.result_list.insert(tk.END, str(result))

    def _finish_error(self, message: str) -> None:
        self.progress.stop()
        self.convert_button.config(state="normal")
        self.open_folder_button.config(state="disabled")
        self.status_var.set("Nao foi possivel converter.")
        self.detail_var.set(message)
        self.result_list.insert(tk.END, message)

    def _open_output_folder(self) -> None:
        if not self.last_output_folder:
            return
        try:
            os.startfile(self.last_output_folder)
        except OSError as exc:
            messagebox.showerror("Nao foi possivel abrir a pasta", str(exc))

    def _is_folder_mode(self) -> bool:
        return self.mode_var.get() == "folder"


if __name__ == "__main__":
    DbcConverterApp().mainloop()
