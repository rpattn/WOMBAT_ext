# Extended WOMBAT (Windfarm Operations & Maintenance cost-Benefit Analysis Tool)
Extended version of the NREL WOMBAT Project!
- And experimenting with Vibe Coding (scary!!)

https://rpattn.github.io/WOMBAT_ext

## Installation
Reccommended installation vs. WOMBAT guide

1. Install UV:\
`curl -LsSf https://astral.sh/uv/install.sh | sh`

2. Create Virtual Environment (venv):\
`uv venv $name` where `$name` is the name of the venv, e.g. venv

3. Activate venv:\
Bash: `source .$name/bin/activate`\
Windows: `.$name\bin\activate(.bat or .ps1)`

4. Install requirements:\
Dev: `uv pip install -e '.[dev]'`\
Standard: `uv pip install .`

5. Set python interpreter:\
Set python interpreter to `.$name/bin/python` in VS code or as kernel in ipynb notebook

6. Install client dependencies:\
`cd client`\
`npm install`

## Running

Server:\
`python -m uvicorn server.main:app` \
or \
`.\server\start.bat`

Client:\
`cd client`\
`npm run dev`

## Mock API Worker & Offline Mode

When the backend is unavailable, the client now automatically falls back to a mock Web Worker with a one-time toast warning:

- __Toast__: "Server unavailable. Using mock Web Worker. Some behavior may be unexpected."
- __Seeded data__: the worker hosts a virtual filesystem with Dinwoodie-like files (e.g., `project/config/base.yaml`, `project/plant/layout.csv`, `weather/alpha_ventus_weather_2002_2014.csv`, `cables/array.yaml`, `cables/export.yaml`, `turbines/vestas_v90.yaml`, `turbines/vestas_v90_power_curve.csv`, and `vessels/ctv*.yaml`).
- __Saved libraries__: includes `dinwoodie_mock` and `dinwoodie_base` for quick loading.

This improves offline/fallback simulation fidelity without requiring the server.

## Live Site (GitHub Pages)

WOMBAT_ext UI is published at:

- https://rpattn.github.io/WOMBAT_ext

## Frontend Testing (Vitest + React Testing Library)

Client-side tests are configured with Vitest and React Testing Library.

- **Key files**
  - `client/vitest.config.ts` — Vitest config (jsdom, setup files, coverage)
  - `client/src/test/setupTests.ts` — jsdom setup, matchMedia polyfill, WebSocket mock
  - `client/src/test/test-utils.tsx` — `renderWithProviders()` (MemoryRouter + Toast + WebSocket providers)
  - `client/src/__tests__/` — test files (`*.test.tsx`)
  - `client/tsconfig.app.json` — includes `"types": ["vite/client", "vitest/globals"]`
- **Run tests**
  npm run test

  # watch mode
  npm run test:watch

  # coverage report (text + lcov)
  npm run test:coverage
  ```

- **IDE TypeScript notes**
  - If `describe/test/expect` are not recognized, ensure `client/tsconfig.app.json` has `vitest/globals` in `types`, then restart the TS server.

- **Writing tests**
  - Prefer `renderWithProviders` from `client/src/test/test-utils.tsx` so components get the necessary providers.
  - Example:
    ```tsx
    import { screen } from '@testing-library/react'
    import { renderWithProviders } from '../test/test-utils'
    import App from '../App'

    test('renders results page', () => {
      renderWithProviders(<App />, { routerProps: { initialEntries: ['/results'] } })
      expect(screen.getByRole('heading', { name: /results/i })).toBeInTheDocument()
    })
    ```

- **Environment polyfills & mocks**
  - `setupTests.ts` provides a `window.matchMedia` polyfill for components that check color scheme.
  - A lightweight `WebSocket` mock is installed globally and tracks instances at `globalThis.__wsInstances` for assertions in tests.

## Deployment

Server: \
`./.venv/Scripts/python.exe ./server/main.py`

Client: \
`cd client` \
`npm run build` \
`npm run preview`

## Description 
Extended WOMBAT adds a lightweight web UI and realtime server layer around the core WOMBAT simulation library. It lets you run simulations, stream progress/events, and visualize results from a browser while keeping the original Python modeling capabilities.

Key goals:
- Rapid local iteration on scenarios and libraries
- Realtime feedback via WebSockets
- Minimal friction to deploy and share demos

## Project Structure
- `server/` — FastAPI app exposing a health endpoint and a WebSocket at `ws://<host>/ws`.
  - `main.py` — app setup, CORS, `/healthz`, `/ws`.
  - `client_manager.py` — tracks connected clients and IDs.
  - `message_handler.py` — routes incoming WS messages to actions.
  - `simulation_manager.py` — orchestration for running simulations.
  - `library_manager.py` — manages temp and user-provided WOMBAT libraries.
  - `event_handlers.py` — emits server-side events/messages.
- `client/` — React + Vite + TypeScript UI.
  - `src/components/` — UI widgets like `WebSocketClient.tsx`, `SimulationControls.tsx`, `SelectedFileInfo.tsx`.
  - `vite.config.ts`, `index.html` — frontend tooling and entry.
- `library/` — extended or example simulation assets used by the server.
- `wombat/` — upstream WOMBAT Python package (vendored for local development/testing).
- `examples/`, `docs/`, `tests/` — examples, documentation, and test suites from WOMBAT.

## Architecture 
- Frontend connects to the server WebSocket (`/ws`) to send control messages (e.g., run, stop, load library) and receive stream updates (status, logs, results).
- Server is a FastAPI app that:
  - Accepts WS connections, assigns a `client_id`, and registers them in `client_manager`.
  - Uses `message_handler` to parse messages and invoke `simulation_manager` and `library_manager` actions.
  - Streams progress/events back to the originating client.
- Simulation logic and data models rely on the WOMBAT library for discrete-event simulation (SimPy-based) while the server layer focuses on orchestration and messaging.

## Technologies
- Backend: Python, FastAPI, Uvicorn, WebSockets, CORS
- Simulation: WOMBAT (SimPy-based), NumPy/Pandas (per upstream), attrs, etc.
- Frontend: React 19, TypeScript 5, Vite 7
- Realtime: Native WebSocket in server; client includes `socket.io-client` for potential future use
- Tooling: ESLint, TypeScript ESLint, Black, isort, Ruff, pytest

## Code philosophy
- Separation of concerns: server orchestration vs. simulation engine vs. UI.
- Explicit typing and linting: mypy/ruff on Python; TypeScript/ESLint on frontend.
- Simple, observable flows: messages routed centrally in `message_handler.py` and emitted via WS.
- Extensibility: modular managers (`client_manager`, `simulation_manager`, `library_manager`) to add new actions/features with minimal coupling.
- Developer ergonomics: hot-reload Vite UI, simple `uvicorn` server, minimal configuration to get started.

## Schema validation and generation

WOMBAT_ext exposes JSON Schemas for validating configuration and library YAML/JSON files. Schemas are generated programmatically and served via the API.

- **Generator**: `wombat/utilities/schema_gen.py`
  - Builds JSON Schema (Draft 2020-12) from `attrs`-based models.
  - Maps Python/typing annotations to schema types; parses Numpy-style docstrings for field descriptions.
  - Adds simple enums when `attrs.validators.in_(...)` is present.
  - Provides pragmatic schemas for complex library files (e.g., `turbine`, `substation`, `cable`).

- **API**: `server/routers/schemas.py`
  - `GET /schemas` — lists available schema names.
  - `GET /schemas/{name}` — returns a single schema by name.
  - `GET /schemas/service_equipment/variants` — returns scheduled, unscheduled, and combined variants.

- **Available names** (from `list_schemas()`):
  - `configuration`
  - `service_equipment`
  - `service_equipment/variants`
  - `service_equipment_scheduled`
  - `service_equipment_unscheduled`
  - `substation`
  - `turbine`
  - `equipment_turbine`
  - `cable`
  - `equipment_cable`
  - `project_port`

- **Fetch examples**
  - Single schema: `curl http://127.0.0.1:8000/schemas/turbine`
  - All names: `curl http://127.0.0.1:8000/schemas`
  - Service equipment variants: `curl http://127.0.0.1:8000/schemas/service_equipment/variants`

- **Generate in Python**
  ```python
  from wombat_api.utilities.schema_gen import schema_by_name

  turbine_schema = schema_by_name("turbine")
  config_schema = schema_by_name("configuration")
  ```

Notes:
- Schemas are intentionally conservative and focus on structure/types. Some domain constraints may be relaxed for compatibility across libraries.
- The `configuration` schema specializes `service_equipment` to allow IDs or pairs like `[count, name]` or `[name, count]`.

## Additions

### Gantt Chart
See `examples/dinwoodie_gantt_chart.py` proof of concept

<details>
<summary>WOMBAT/main README.md</summary>

# WOMBAT: Windfarm Operations & Maintenance cost-Benefit Analysis Tool

[![DOI 10.2172/1894867](https://img.shields.io/badge/DOI-10.2172%2F1894867-brightgreen?link=https://doi.org/10.2172/1894867)](https://www.osti.gov/biblio/1894867)
[![PyPI version](https://badge.fury.io/py/wombat.svg)](https://badge.fury.io/py/wombat)
[![codecov](https://codecov.io/gh/WISDEM/WOMBAT/branch/main/graph/badge.svg?token=SK9M10BZXY)](https://codecov.io/gh/WISDEM/WOMBAT)
[![Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/WISDEM/WOMBAT/main?filepath=examples)
[![Jupyter Book](https://jupyterbook.org/badge.svg)](https://wisdem.github.io/WOMBAT)

[![Pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit&logoColor=white)](https://github.com/pre-commit/pre-commit)
[![Black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
[![isort](https://img.shields.io/badge/%20imports-isort-%231674b1?style=flat&labelColor=ef8336)](https://pycqa.github.io/isort/)

This library provides a tool to simulate the operation and maintenance phase (O&M) of
distributed, land-based, and offshore windfarms using a discrete event simultaion
framework.

WOMBAT is written around the [`SimPy`](https://gitlab.com/team-simpy/simpy) discrete
event simulation framework. Additionally, this is supported using a flexible and modular
object-oriented code base, which enables the modeling of arbitrarily large (or small)
windfarms with as many or as few failure and maintenance tasks that can be encoded.

Please note that this is still heavily under development, so you may find some functionality
to be incomplete at the current moment, but rest assured the functionality is expanding.
With that said, it would be greatly appreciated for issues or PRs to be submitted for
any improvements at all, from fixing typos (guaranteed to be a few) to features to
testing.

If you use this library please cite our NREL Technical Report:

```bibtex
   @techreport{hammond2022wombat,
      title = {Windfarm Operations and Maintenance cost-Benefit Analysis Tool (WOMBAT)},
      author = {Hammond, Rob and Cooperman, Aubryn},
      abstractNote = {This report provides technical documentation and background on the newly-developed Wind Operations and Maintenance cost-Benefit Analysis Tool (WOMBAT) software. WOMBAT is an open-source model that can be used to obtain cost estimates for operations and maintenance of land-based or offshore wind power plants. The software was designed to be flexible and modular to allow for implementation of new strategies and technological innovations for wind plant maintenance. WOMBAT uses a process-based simulation approach to model day-to-day operations, repairs, and weather conditions. High-level outputs from WOMBAT, including time-based availability and annual operating costs, are found to agree with published results from other models.},
      doi = {10.2172/1894867},
      url = {https://www.osti.gov/biblio/1894867},
      place = {United States},
      year = {2022},
      month = {10},
      institution = {National Renewable Energy Lab. (NREL)},
   }
```

## Part of the WETO Stack

WOMBAT is primarily developed with the support of the U.S. Department of Energy and is part of the [WETO Software Stack](https://nrel.github.io/WETOStack). For more information and other integrated modeling software, see:
- [Portfolio Overview](https://nrel.github.io/WETOStack/portfolio_analysis/overview.html)
- [Entry Guide](https://nrel.github.io/WETOStack/_static/entry_guide/index.html)
- [Techno-Economic Modeling Workshop](https://nrel.github.io/WETOStack/workshops/user_workshops_2024.html#tea-and-cost-modeling)
- [Systems Engineering Workshop](https://nrel.github.io/WETOStack/workshops/user_workshops_2024.html#systems-engineering)

## WOMBAT in Action

There a few Jupyter notebooks to get users up and running with WOMBAT in the `examples/`
folder, but here are a few highlights:

> **Note**
> In v0.6 the results will diverge significantly under certain modeling conditions from
> past versions due to substantial model upgrades on the backend and new/updated
> features to better specify how repairs are managed.

* Dinwoodie, et al. replication for `wombat` can be found in the
  `examples folder <https://github.com/WISDEM/WOMBAT/blob/main/examples/dinwoodie_validation.ipynb>`_.
* IEA Task 26
  `validation exercise  <https://github.com/WISDEM/WOMBAT/blob/main/examples/iea_26_validation.ipynb>`_.
* Presentations: `slides  <https://github.com/WISDEM/WOMBAT/blob/main/presentation_material/>`_.


## Setup

### Requirements

* Python 3.9 through 3.12

### Environment Setup

Download the latest version of [Miniconda](https://docs.conda.io/en/latest/miniconda.html)
for the appropriate OS. Follow the remaining
[steps](https://conda.io/projects/conda/en/latest/user-guide/install/index.html#regular-installation)
for the appropriate OS version.

Using conda, create a new virtual environment:

```console
conda create -n <environment_name> python=3.11
conda activate <environment_name>
conda install -c anaconda pip

# activate the environment
conda activate <environment_name>

# to deactivate
conda deactivate
```

### Installation

Once in your desired environment, WOMBAT can be installed from PyPI via `pip install`
or from source.

#### Pip

This option is best for those working with the latest release, or including WOMBAT as
a tool in a workflow without the desire to modify the source code.

```console
pip install wombat
```

#### From Source

This option is ideal for users that wish to work with the examples, modify the source
code, and/or contribute back to the project.

Install it directly into an activated virtual environment:

```console
git clone https://github.com/WISDEM/WOMBAT.git
cd wombat
python setup.py install

# Alternatively:
pip install .
```

#### Usage

After installation, the package can imported:

```console
python
import wombat
wombat.__version__
```

For further usage, please see the documentation site at https://wisdem.github.io/WOMBAT.

### Requirements for Contributing to WOMBAT

#### Code Contributions

Code contributors should note that there is both an additional dependency suite for
running the tests and enabling the pre-commit workflow to automatically standardize the
core code formatting principles. In short, the following steps should be taken, but be
sure to read the
[contributor's guide](https://wisdem.github.io/WOMBAT/contributing.html)

```console
git clone https://github.com/WISDEM/WOMBAT.git
cd wombat

# Install the additional dependencies for running the tests and automatic code formatting
pip install -e '.[dev]'

# Enable the pre-commit workflow for automatic code formatting
pre-commit install

# ... contributions and commits ...

# Run the tests and ensure they all pass
pytest tests
```

Basic pre-commit issues that users might encounter and their remedies:

* For any failed run, changes may have been either automatically applied or require
  further edits from the contributor. In either case, after changes have been made,
  contributors will have to rerun `git add <the changed files>` and
  `git commit -m <the commit message>` to restart the pre-commit workflow with the
  applied changes. Once all checks pass, the commit is safe to be pushed.
* `isort`, `black`, or simple file checks failed, but made changes
  * rerun the `add` and `commit` processes as needed until the changes satisfy the checks
* `ruff` failed:
  * Address the errors and rerun the `add` and `commit` processes
* `mypy` has type errors that seem incorrect
  * Double check the typing is in fact as correct as it seems it should be and rerun the
  `add` and `commit` processes
  * If `mypy` simply seems confused with seemingly correct types, the following statement
  can be added above the `mypy` error:
  `assert isinstance(<variable of concern>, <the type you think mypy should be registering>)`
  * If that's still not working, but you are definitely sure the types are correct,
  simply add a `# type ignore` comment at the end of the line. Sometimes `mypy` struggles
  with complex scenarios, or especially with certain `attrs` conventions.

#### Documentation Contributions

```console
git clone https://github.com/WISDEM/WOMBAT.git
cd wombat
pip install -e '.[docs]'
```

Build the site

> **Note**
> You may want to change the "execute_notebooks" parameter in the `docs/_config.yaml`
> file to "off" unless you're updating the coded examples, or they will be run every
> time you build the site.

```console
jupyter-book build docs
```

View the results: `docs/_build/html/index.html`

#### Code and Documentation Contributions

```console
git clone https://github.com/WISDEM/WOMBAT.git
cd wombat
pip install -e '.[all]'
```

### Dependencies

Standard dependencies:

* attrs>=21
* numpy>=1.21
* scipy>=1.8
* pandas>=2
* polars>=0.17
* pyarrow>=10
* jupyterlab>=3
* simpy>=4.0.1
* pyyaml>=6
* geopy>=2.3
* networkx>=2.7
* matplotlib>=3.3
* types-attrs>=19
* types-typed-ast>=1.5
* types-PyYAML>=6
* types-python-dateutil>=2.8

Optional "dev" dependencies:

* pre-commit>=2.20
* isort>=5.10
* pytest>=7
* pytest-cov>=4
* mypy==0.991
* ruff>=0.2
* pyupgrade

Optional "docs" dependencies:

* jupyter-book>=0.15
* myst-nb>=0.16
* myst-parser>=0.17
* linkify-it-py>=2
* sphinx-autodoc-typehints
* sphinxcontrib-autoyaml
* sphinxcontrib-bibtex>=2.4
* sphinxcontrib-spelling>=7
</details>