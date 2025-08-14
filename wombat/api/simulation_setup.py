

from pathlib import Path
import shutil
import uuid

from wombat.core.library import create_library_structure, load_yaml

def create_temp_library(base_dir: Path) -> Path:
    """Create a temporary library structure and copy necessary files from DINWOODIE."""
    # Create temp directory
    temp_dir = base_dir / Path(f"sim_{uuid.uuid4().hex[:8]}")
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Create library structure
    create_library_structure(temp_dir, create_init=True)

    # Copy files from DINWOODIE library
    source_lib = Path("library/code_comparison/dinwoodie")
    
    # Copy weather data
    shutil.copytree(source_lib / "weather", temp_dir / "weather", dirs_exist_ok=True)
    
    # Copy project files
    shutil.copytree(source_lib / "project", temp_dir / "project", dirs_exist_ok=True)
    
    # Copy other directories
    for subdir in ["cables", "substations", "turbines", "vessels"]:
        if (source_lib / subdir).exists():
            shutil.copytree(source_lib / subdir, temp_dir / subdir, dirs_exist_ok=True)

    return temp_dir


def create_library(base_dir: Path, copy_from_dir: Path) -> Path:
    """Create a library structure and copy necessary files from copy_from_dir."""
    # Create temp directory
    temp_dir = base_dir / Path(f"sim_{uuid.uuid4().hex[:8]}")
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Create library structure
    create_library_structure(temp_dir, create_init=True)
    
    # Copy weather data
    shutil.copytree(copy_from_dir / "weather", temp_dir / "weather", dirs_exist_ok=True)
    
    # Copy project files
    shutil.copytree(copy_from_dir / "project", temp_dir / "project", dirs_exist_ok=True)
    
    # Copy other directories
    for subdir in ["cables", "substations", "turbines", "vessels"]:
        if (copy_from_dir / subdir).exists():
            shutil.copytree(copy_from_dir / subdir, temp_dir / subdir, dirs_exist_ok=True)

    return temp_dir


def create_temp_config(library_path: Path, config_name: str = "base_2yr.yaml") -> Path:
    """Create a temporary config file with the correct library path."""
    # Load the original config
    original_config = load_yaml(Path("library/code_comparison/dinwoodie/project/config"), config_name)
    
    # Update the library path to point to our temp library
    original_config["library"] = str(library_path)
    
    # Write the modified config to temp location
    config_path = library_path / "project" / "config" / config_name
    with open(config_path, "w") as f:
        import yaml
        yaml.dump(original_config, f, default_flow_style=False, sort_keys=False)
    
    return config_path