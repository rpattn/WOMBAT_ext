import type { ReactNode } from "react";
import { useState, useRef, useEffect } from "react";

type Props = {
    children: ReactNode
    minWidth?: number
    maxWidth?: number
    lsKey?: string
    addFillerPane?: boolean
    defaultWidth?: number
    collapsible?: boolean
    defaultCollapsed?: boolean
}

export default function ResizeWrapper({ children, minWidth = 240, maxWidth = 900, lsKey = 'wombat-resize', addFillerPane = true, defaultWidth = 400, collapsible = true, defaultCollapsed = false }: Props) {

    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        try {
            const v = Number(window.localStorage.getItem(lsKey) || '')
            return Number.isFinite(v) && v >= minWidth && v <= maxWidth ? v : minWidth
        } catch { return minWidth }
    })
    const draggingRef = useRef(false)
    const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed)
    const lastWidthRef = useRef<number>(defaultWidth)

    useEffect(() => {
        if (!collapsed) {
            try { window.localStorage.setItem(lsKey, String(sidebarWidth)) } catch { }
        }
    }, [sidebarWidth, collapsed])

    useEffect(() => {
        function onMove(e: MouseEvent) {
            if (!draggingRef.current) return
            const dx = e.movementX
            setSidebarWidth(w => {
                let nw = w + dx
                const collapseThreshold = Math.min(Math.max(24, minWidth * 0.5), minWidth)
                // If user drags past threshold OR is already at minWidth and keeps dragging left, collapse
                if (collapsible && (nw <= collapseThreshold || (w <= minWidth + 1 && dx < 0))) {
                    lastWidthRef.current = Math.max(minWidth, w)
                    setCollapsed(true)
                    draggingRef.current = false
                    return w
                }
                if (nw < minWidth) nw = minWidth
                if (nw > maxWidth) nw = maxWidth
                return nw
            })
            e.preventDefault()
        }
        function onUp() { draggingRef.current = false }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
    }, [])

    return (
        <div className="row" style={{ gap: 0, alignItems: 'stretch' }}>
            <aside
                style={{
                    minWidth: collapsed ? 0 : minWidth,
                    flex: collapsed ? `0 0 0px` : `0 0 ${sidebarWidth}px`,
                    maxWidth: collapsed ? 0 : maxWidth,
                    overflow: collapsed ? 'hidden' as const : undefined,
                    borderRight: collapsed ? 'none' : '1px solid var(--color-border)'
                }}
            >
                {children}
            </aside>
            <div
                onMouseDown={() => {
                    if (collapsible && collapsed) {
                        // expand on click when collapsed
                        setCollapsed(false)
                        setSidebarWidth(lastWidthRef.current || defaultWidth)
                        return
                    }
                    draggingRef.current = true
                }}
                onDoubleClick={() => {
                    if (collapsible && !collapsed) {
                        // reset width when expanded
                        setSidebarWidth(defaultWidth)
                        lastWidthRef.current = defaultWidth
                    } else if (collapsible && collapsed) {
                        setCollapsed(false)
                        setSidebarWidth(lastWidthRef.current || defaultWidth)
                    }
                }}
                style={{
                    width: 8,
                    cursor: 'col-resize',
                    userSelect: 'none',
                    background: 'rgba(0,0,0,0.03)',
                    position: 'relative',
                    margin: '0px 2px',
                    zIndex: 1,
                }}
                aria-label="Resize sidebar"
                title={collapsed ? 'Click to expand sidebar' : 'Drag to resize. Double-click to reset.'}
                role="separator"
                aria-orientation="vertical"
                aria-expanded={!collapsed}
                onClick={() => {
                    if (collapsible && collapsed) {
                        setCollapsed(false)
                        setSidebarWidth(lastWidthRef.current || defaultWidth)
                    }
                }}
            >
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 3, width: 2, background: 'var(--color-border)' }} />
            </div>
            {addFillerPane && (
                <div style={{ flex: 1, minWidth: 0 }} aria-hidden="true" />
            )}
        </div>
    )
}