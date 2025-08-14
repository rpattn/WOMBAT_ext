import React, { useState, useMemo, useEffect } from 'react';
import './FileSelector.css';

interface FileSelectorProps {
  onFileSelect: (fileName: string) => void;
  selectedFile?: string;
  libraryFiles?: { yaml_files: string[]; csv_files: string[]; total_files?: number };
  onAddFile?: (filePath: string, content: any) => void;
  onDeleteFile?: (filePath: string) => void;
  onReplaceFile?: (filePath: string) => void;
  onDownloadFile?: (filePath: string) => void;
  projectName?: string;
}

interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  fullPath?: string;
  isExpanded?: boolean;
  folderFullPath?: string; // for folders only, using \\ separators relative to project root
}

const FileSelector: React.FC<FileSelectorProps> = ({ onFileSelect, selectedFile, libraryFiles, onAddFile, onDeleteFile, onReplaceFile, onDownloadFile, projectName }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const rootLabel = useMemo(() => (projectName && projectName.trim().length > 0 ? projectName : 'Library Files'), [projectName]);

  const buildTreeStructure = useMemo(() => {
    const root: TreeNode = { name: rootLabel, type: 'folder', children: [], folderFullPath: '' };
    const yaml = libraryFiles?.yaml_files ?? [];
    const csv = libraryFiles?.csv_files ?? [];
    const allFiles = [...yaml, ...csv];

    allFiles.forEach(filePath => {
      const parts = filePath.split('\\');
      let currentNode = root;

      // Navigate through the path, creating folders as needed
      let accFolderPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        accFolderPath = accFolderPath ? `${accFolderPath}\\${folderName}` : folderName;
        let folderNode = currentNode.children?.find(child => 
          child.name === folderName && child.type === 'folder'
        );

        if (!folderNode) {
          folderNode = {
            name: folderName,
            type: 'folder',
            children: [],
            isExpanded: true,
            folderFullPath: accFolderPath
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
  }, [libraryFiles, rootLabel]);

  // Expand root and "project" and "project/config" by default when present
  useEffect(() => {
    const next = new Set<string>();
    next.add(rootLabel);
    const yaml = libraryFiles?.yaml_files ?? [];
    const csv = libraryFiles?.csv_files ?? [];
    const allFiles = [...yaml, ...csv];
    const parts = allFiles.map(p => (p || '').split('\\'));
    const hasProject = parts.some(seg => seg[0] === 'project');
    const hasProjectConfig = parts.some(seg => seg[0] === 'project' && seg[1] === 'config');
    if (hasProject) {
      next.add(`${rootLabel}/project`);
    }
    if (hasProjectConfig) {
      next.add(`${rootLabel}/project/config`);
    }
    setExpandedFolders(next);
  }, [rootLabel, libraryFiles]);

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

  const promptAndAddFile = (folderPath: string, kind: 'yaml' | 'csv') => {
    const suggested = kind === 'yaml' ? 'new_file.yaml' : 'new_file.csv';
    const name = window.prompt(`Enter ${kind.toUpperCase()} file name`, suggested);
    if (!name) return;
    const sanitized = name.endsWith(`.${kind}`) ? name : `${name}.${kind}`;
    const relPath = folderPath ? `${folderPath}\\${sanitized}` : sanitized;
    const defaultContent = kind === 'yaml' ? {} : 'col1,col2\n';
    onAddFile?.(relPath, defaultContent);
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
            style={{ ['--indent' as any]: `${level * 20}px` }}
            onClick={() => toggleFolder(currentPath)}
          >
            <span className={`folder-icon ${isExpanded ? 'expanded' : ''}`}>
              {isExpanded ? '📂' : '📁'}
            </span>
            <span className="folder-name">{node.name}</span>
            <span className="actions folder-actions" onClick={(e) => e.stopPropagation()}>
              <button
                title="Add YAML file here"
                className="btn btn-outline-violet"
                onClick={() => promptAndAddFile(node.folderFullPath ?? '', 'yaml')}
              >+ YAML</button>
              <button
                title="Add CSV file here"
                className="btn btn-outline-emerald"
                onClick={() => promptAndAddFile(node.folderFullPath ?? '', 'csv')}
              >+ CSV</button>
            </span>
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
          style={{ ['--indent' as any]: `${level * 20 + 20}px` }}
          onClick={() => handleFileSelect(node.fullPath!)}
        >
          <span className="file-icon">{fileIcon}</span>
          <span className="file-name">{node.name}</span>
          <span className="actions file-actions">
            <button
              title="Download file"
              className="btn btn-outline-primary"
              onClick={(e) => {
                e.stopPropagation();
                if (!node.fullPath) return;
                onDownloadFile?.(node.fullPath);
              }}
            >Download</button>
            <button
              title="Delete file"
              className="btn btn-outline-danger"
              onClick={(e) => {
                e.stopPropagation();
                if (!node.fullPath) return;
                const confirmDel = window.confirm(`Delete file: ${node.fullPath}?`);
                if (!confirmDel) return;
                onDeleteFile?.(node.fullPath);
              }}
            >Delete</button>
            <button
              title="Replace file (upload)"
              className="btn btn-outline-primary"
              onClick={(e) => {
                e.stopPropagation();
                if (!node.fullPath) return;
                onReplaceFile?.(node.fullPath);
              }}
            >Replace</button>
          </span>
        </div>
      );
    }
  };

  return (
    <div className="file-selector">
      <div className="file-selector-header">
        <h3>Select a Configuration File</h3>
        <p className="file-count">
          {(libraryFiles?.yaml_files?.length ?? 0)} YAML files, {(libraryFiles?.csv_files?.length ?? 0)} CSV files
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
