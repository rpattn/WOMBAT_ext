import React, { useState, useMemo } from 'react';
import './FileSelector.css';
import { example_library_structure } from '../App';

interface FileSelectorProps {
  onFileSelect: (fileName: string) => void;
  selectedFile?: string;
}

interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  fullPath?: string;
  isExpanded?: boolean;
}

const FileSelector: React.FC<FileSelectorProps> = ({ onFileSelect, selectedFile }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));

  const buildTreeStructure = useMemo(() => {
    const root: TreeNode = { name: 'Library Files', type: 'folder', children: [] };
    const allFiles = [...example_library_structure.yaml_files, ...example_library_structure.csv_files];

    allFiles.forEach(filePath => {
      const parts = filePath.split('\\');
      let currentNode = root;

      // Navigate through the path, creating folders as needed
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        let folderNode = currentNode.children?.find(child => 
          child.name === folderName && child.type === 'folder'
        );

        if (!folderNode) {
          folderNode = {
            name: folderName,
            type: 'folder',
            children: [],
            isExpanded: false
          };
          currentNode.children = currentNode.children || [];
          currentNode.children.push(folderNode);
        }

        currentNode = folderNode;
      }

      // Add the file
      const fileName = parts[parts.length - 1];
      currentNode.children = currentNode.children || [];
      currentNode.children.push({
        name: fileName,
        type: 'file',
        fullPath: filePath
      });
    });

    // Sort children: folders first, then files, both alphabetically
    const sortChildren = (node: TreeNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
      }
    };

    sortChildren(root);
    return root;
  }, []);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const handleFileSelect = (filePath: string) => {
    onFileSelect(filePath);
  };

  const renderTreeNode = (node: TreeNode, path: string = '', level: number = 0): React.ReactNode => {
    const currentPath = path ? `${path}/${node.name}` : node.name;
    const isExpanded = expandedFolders.has(currentPath);
    const isSelected = selectedFile === node.fullPath;

    if (node.type === 'folder') {
      return (
        <div key={currentPath} className="tree-folder">
          <div 
            className="tree-folder-header"
            style={{ paddingLeft: `${level * 20}px` }}
            onClick={() => toggleFolder(currentPath)}
          >
            <span className={`folder-icon ${isExpanded ? 'expanded' : ''}`}>
              {isExpanded ? '📂' : '📁'}
            </span>
            <span className="folder-name">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div className="tree-folder-content">
              {node.children.map(child => renderTreeNode(child, currentPath, level + 1))}
            </div>
          )}
        </div>
      );
    } else {
      const fileExtension = node.name.split('.').pop()?.toLowerCase();
      const fileIcon = fileExtension === 'yaml' ? '📄' : fileExtension === 'csv' ? '📊' : '📄';
      
      return (
        <div 
          key={currentPath}
          className={`tree-file ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${level * 20 + 20}px` }}
          onClick={() => handleFileSelect(node.fullPath!)}
        >
          <span className="file-icon">{fileIcon}</span>
          <span className="file-name">{node.name}</span>
        </div>
      );
    }
  };

  return (
    <div className="file-selector">
      <div className="file-selector-header">
        <h3>Select a Configuration File</h3>
        <p className="file-count">
          {example_library_structure.yaml_files.length} YAML files, {example_library_structure.csv_files.length} CSV files
        </p>
      </div>
      <div className="file-tree">
        {renderTreeNode(buildTreeStructure)}
      </div>
      {selectedFile && (
        <div className="selected-file-info">
          <strong>Selected:</strong> {selectedFile}
        </div>
      )}
    </div>
  );
};

export default FileSelector;
