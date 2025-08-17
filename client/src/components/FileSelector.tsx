import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import './FileSelector.css';

interface FileSelectorProps {
  onFileSelect: (fileName: string) => void;
  selectedFile?: string;
  libraryFiles?: { yaml_files: string[]; csv_files: string[]; html_files?: string[]; png_files?: string[]; total_files?: number };
  onAddFile?: (filePath: string, content: any) => void;
  onDeleteFile?: (filePath: string) => void;
  onReplaceFile?: (filePath: string) => void;
  onDownloadFile?: (filePath: string) => void;
  projectName?: string;
  showActions?: boolean; // when false, hide hover action buttons (e.g., on Results page)
  // Optional list of top-level folders to expand by default if present (e.g., ["results"]).
  defaultExpandFolders?: string[];
}

interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  fullPath?: string;
  folderFullPath?: string; // for folders only, using \\ separators relative to project root
}

const FileSelector: React.FC<FileSelectorProps> = ({ onFileSelect, selectedFile, libraryFiles, onAddFile, onDeleteFile, onReplaceFile, onDownloadFile, projectName, showActions = true, defaultExpandFolders = [] }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const rootLabel = useMemo(() => (projectName && projectName.trim().length > 0 ? projectName : 'Library Files'), [projectName]);

  // Normalize a file path to parts in a cross-platform way
  const normalizeParts = useCallback((filePath: string): string[] => {
    if (!filePath) return [];
    return filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  }, []);

  const buildTreeStructure = useMemo(() => {
    const root: TreeNode = { name: rootLabel, type: 'folder', children: [], folderFullPath: '' };
    const yaml = libraryFiles?.yaml_files ?? [];
    const csv = libraryFiles?.csv_files ?? [];
    const html = libraryFiles?.html_files ?? [];
    const png = libraryFiles?.png_files ?? [];
    const allFiles = [...yaml, ...csv, ...html, ...png];

    allFiles.forEach(filePath => {
      const parts = normalizeParts(filePath);
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
  }, [libraryFiles, rootLabel, normalizeParts]);

  // Track last applied root label to know when to re-initialize
  const lastRootLabelRef = useRef<string>(rootLabel);

  // Simple loading indicator: show while we have files but expansion hasn't been applied yet
  const totalFiles = useMemo(() => {
    const yaml = libraryFiles?.yaml_files?.length ?? 0;
    const csv = libraryFiles?.csv_files?.length ?? 0;
    const html = libraryFiles?.html_files?.length ?? 0;
    const png = libraryFiles?.png_files?.length ?? 0;
    return yaml + csv + html + png;
  }, [libraryFiles]);
  const isRefreshing = expandedFolders.size === 0 && totalFiles > 0;

  // When the underlying file list changes (e.g., loading a saved project), reset expansion
  // Removed to reduce rerenders; rely on rootLabel change and init effect

  // Initialize default expanded folders once, or whenever the root label changes.
  useEffect(() => {
    const rootChanged = lastRootLabelRef.current !== rootLabel;
    const shouldInit = expandedFolders.size === 0 || rootChanged;
    if (!shouldInit) return; // respect user state unless root changed
    const next = new Set<string>();
    next.add(rootLabel);
    const yaml = libraryFiles?.yaml_files ?? [];
    const csv = libraryFiles?.csv_files ?? [];
    const html = libraryFiles?.html_files ?? [];
    const png = libraryFiles?.png_files ?? [];
    const allFiles = [...yaml, ...csv, ...html, ...png];
    const parts = allFiles.map(p => normalizeParts(p || ''));
    const hasProject = parts.some(seg => seg[0] === 'project');
    const hasProjectConfig = parts.some(seg => seg[0] === 'project' && seg[1] === 'config');
    if (hasProject) next.add(`${rootLabel}/project`);
    if (hasProjectConfig) next.add(`${rootLabel}/project/config`);
    for (const folderName of defaultExpandFolders) {
      if (!folderName) continue;
      const hasFolder = parts.some(seg => seg[0] === folderName);
      if (hasFolder) next.add(`${rootLabel}/${folderName}`);
    }
    setExpandedFolders(next);
    lastRootLabelRef.current = rootLabel;
  }, [rootLabel, libraryFiles, defaultExpandFolders, expandedFolders.size, normalizeParts]);

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  }, []);

  const handleFileSelect = useCallback((filePath: string) => {
    onFileSelect(filePath);
  }, [onFileSelect]);

  const promptAndAddFile = useCallback((folderPath: string, kind: 'yaml' | 'csv') => {
    const suggested = kind === 'yaml' ? 'new_file.yaml' : 'new_file.csv';
    const name = window.prompt(`Enter ${kind.toUpperCase()} file name`, suggested);
    if (!name) return;
    const sanitized = name.endsWith(`.${kind}`) ? name : `${name}.${kind}`;
    const relPath = folderPath ? `${folderPath}\\${sanitized}` : sanitized;
    const defaultContent = kind === 'yaml' ? {} : 'col1,col2\n';
    onAddFile?.(relPath, defaultContent);
  }, [onAddFile]);

  const renderTreeNode = useCallback((node: TreeNode, path: string = '', level: number = 0): React.ReactNode => {
    const currentPath = path ? `${path}/${node.name}` : node.name;
    const isExpanded = expandedFolders.has(currentPath);
    const isSelected = selectedFile === node.fullPath;

    if (node.type === 'folder') {
      return (
        <div key={currentPath} className="tree-folder" role="treeitem" aria-expanded={isExpanded} aria-label={node.name}>
          <div 
            className="tree-folder-header"
            style={{ ['--indent' as any]: `${level * 20}px` }}
            onClick={() => toggleFolder(currentPath)}
          >
            <span className={`folder-icon ${isExpanded ? 'expanded' : ''}`}>
              {isExpanded ? '📂' : '📁'}
            </span>
            <span className="folder-name">{node.name}</span>
            {showActions && (
              <span className="actions folder-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  title="Add YAML file here"
                  className="btn btn-success"
                  onClick={() => promptAndAddFile(node.folderFullPath ?? '', 'yaml')}
                >+ YAML</button>
                <button
                  title="Add CSV file here"
                  className="btn btn-success"
                  onClick={() => promptAndAddFile(node.folderFullPath ?? '', 'csv')}
                >+ CSV</button>
              </span>
            )}
          </div>
          {isExpanded && node.children && (
            <div className="tree-folder-content" role="group">
              {node.children.map(child => renderTreeNode(child, currentPath, level + 1))}
            </div>
          )}
        </div>
      );
    } else {
      const fileExtension = node.name.split('.').pop()?.toLowerCase();
      const fileIcon = fileExtension === 'yaml' ? '📄' : fileExtension === 'csv' ? '📊' : fileExtension === 'html' ? '🌐' : fileExtension === 'png' ? '🖼️' : '📄';
      
      return (
        <div 
          key={currentPath}
          className={`tree-file ${isSelected ? 'selected' : ''}`}
          style={{ ['--indent' as any]: `${level * 20 + 20}px` }}
          role="treeitem"
          aria-selected={isSelected}
          onClick={() => handleFileSelect(node.fullPath!)}
        >
          <span className="file-icon">{fileIcon}</span>
          <span className="file-name">{node.name}</span>
          {showActions && (
            <span className="actions file-actions">
              <button
                title="Download file"
                aria-label="Download file"
                className="btn btn-primary"
                style={{ padding: '2px 6px', minWidth: 0, lineHeight: 1.2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!node.fullPath) return;
                  onDownloadFile?.(node.fullPath);
                }}
              >⬇️</button>
              <button
                title="Delete file"
                aria-label="Delete file"
                className="btn btn-danger"
                style={{ padding: '2px 6px', minWidth: 0, lineHeight: 1.2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!node.fullPath) return;
                  const confirmDel = window.confirm(`Delete file: ${node.fullPath}?`);
                  if (!confirmDel) return;
                  onDeleteFile?.(node.fullPath);
                }}
              >🗑️</button>
              <button
                title="Replace file (upload)"
                aria-label="Replace file"
                className="btn btn-primary"
                style={{ padding: '2px 6px', minWidth: 0, lineHeight: 1.2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!node.fullPath) return;
                  onReplaceFile?.(node.fullPath);
                }}
              >↻</button>
            </span>
          )}
        </div>
      );
    }
  }, [expandedFolders, selectedFile, showActions, toggleFolder, handleFileSelect, onDownloadFile, onDeleteFile, onReplaceFile]);

  return (
    <div className="file-selector" role="tree" aria-label={rootLabel}>
      <div className="file-selector-header">
        <h3>Library Files</h3>
        <p className="file-count">
          {(libraryFiles?.yaml_files?.length ?? 0)} YAML, {(libraryFiles?.csv_files?.length ?? 0)} CSV, {(libraryFiles?.html_files?.length ?? 0)} HTML, {(libraryFiles?.png_files?.length ?? 0)} PNG
        </p>
        {isRefreshing && (
          <div className="inline-spinner" aria-live="polite" aria-busy="true" title="Refreshing file tree">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}
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
