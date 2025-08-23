import type { ReactNode } from "react";
import { useState, useRef, useEffect } from "react";

type Props = {
    children: ReactNode
    minWidth?: number
    maxWidth?: number
    lsKey?: string
    addFillerPane?: boolean
}

export default function ResizeWrapper({ children, minWidth = 240, maxWidth = 900, lsKey = 'wombat-resize', addFillerPane = true }: Props) {

    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        try {
            const v = Number(window.localStorage.getItem(lsKey) || '')
            return Number.isFinite(v) && v >= minWidth && v <= maxWidth ? v : minWidth
        } catch { return minWidth }
    })
    const draggingRef = useRef(false)

    useEffect(() => {
        try { window.localStorage.setItem(lsKey, String(sidebarWidth)) } catch { }
    }, [sidebarWidth])

    useEffect(() => {
        function onMove(e: MouseEvent) {
            if (!draggingRef.current) return
            const dx = e.movementX
            setSidebarWidth(w => {
                let nw = w + dx
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
                    minWidth: minWidth,
                    flex: `0 0 ${sidebarWidth}px`,
                    maxWidth: maxWidth,
                    borderRight: '1px solid var(--color-border)'
                }}
                className="panel"
            >
                {children}
            </aside>
            <div
                onMouseDown={() => { draggingRef.current = true }}
                onDoubleClick={() => setSidebarWidth(400)}
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
                title="Drag to resize. Double-click to reset."
            >
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 3, width: 2, background: 'var(--color-border)' }} />
            </div>
            {addFillerPane && (
                <div style={{ flex: 1, minWidth: 0 }} aria-hidden="true" />
            )}
        </div>
    )
}