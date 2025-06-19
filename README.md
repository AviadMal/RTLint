# RTLint - Verilog/SystemVerilog/VHDL Linter for VSCode

<p align="left">
  <img src="https://github.com/AviadMal/RTLint/blob/main/image/logo.png" alt="RTLint Logo" width="300">
</p>

**A lightweight, flexible linter for Verilog/SystemVerilog/VHDL (RTL) inside Visual Studio Code.**  
Supports popular tools: `slang`, `QuestaSim`, `ModelSim`.

---

## ✨ Features

- 🔎 Automatic linting of `.v`, `.sv`, `.svh` files on open or save
- 🧠 Choose your linter: `slang`, `questa`, or `modelsim`
- 📂 Supports `.f` or `.do` files for project-wide linting
- 🚦 Highlight errors and warnings via VSCode diagnostics
- 💾 Saves user settings to `~/.verilog-linter-config.json`
- 🛠️ Command Palette integration:
  - `Select Verilog Linter Tool`
  - `Select Verilog Compile File (.do)`
  - `Toggle Verilog Linter Warnings`

---

## ⚙️ How to Configure

### 1️⃣ Select Linter Tool

To choose the linter tool you want:

1. Open VSCode  
2. Open **Command Palette** (`Ctrl+Shift+P` or `F1`)  
3. Run: `Verilog Linter: Select Verilog Linter Tool`  
4. Select one of:
   - `slang` — fast, lightweight
   - `questa` — Siemens QuestaSim 
   - `modelsim` — Intel ModelSim

> If you select `questa` or `modelsim`, you will be asked to provide the path to the tool binary.

---

### 2️⃣ Compile the Whole Project (Using `.do` or `.f`)

By default, the linter runs per opened file.  
To lint your **entire project** using a compilation file (`.do` or `.f`), do the following:

Open **Command Palette** → `Verilog Linter: Select Verilog Compile File (.do)`  
→ Select your `.do` or `.f` file (example: `compile.do`)


---

## 💻 Supported File Types

- `.v`   — Verilog
- `.sv`  — SystemVerilog
- `.svh` — SystemVerilog Header
- `.vhd` — VHDL

---

## 📦 Available Commands

| Command | Description |
|---|---|
| `Verilog Linter: Select Verilog Linter Tool` | Switch between slang / Questa / ModelSim |
| `Verilog Linter: Select Verilog Compile File (.do)` | Lint full project using .do or .f |
| `Verilog Linter: Toggle Verilog Linter Warnings` | Show or hide warnings |

---

## 📜 License

This project is licensed under the **MIT License** 

---

## 📬 Contact

Feel free to contact: [aviad.malihi@gmail.com](mailto:aviad.malihi@gmail.com)
