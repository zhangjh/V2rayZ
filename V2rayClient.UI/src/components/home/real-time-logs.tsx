import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/store/app-store'
import { Trash2 } from 'lucide-react'
import { getLogs, clearLogs, addEventListener, removeEventListener } from '@/bridge/api-wrapper'
import type { LogEntry } from '@/bridge/types'

export function RealTimeLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const connectionStatus = useAppStore((state) => state.connectionStatus)

  // Load initial logs and set up real-time updates
  useEffect(() => {
    const loadInitialLogs = async () => {
      try {
        const logs = await getLogs(50)
        if (logs) {
          setLogs(logs)
        }
      } catch (error) {
        console.error('Failed to load initial logs:', error)
      }
    }

    // Load initial logs
    loadInitialLogs()

    // Set up real-time log listener
    const handleLogReceived = (logEntry: LogEntry) => {
      setLogs(prev => {
        const updated = [...prev, logEntry]
        // Keep only last 100 logs
        return updated.slice(-100)
      })
    }

    addEventListener('logReceived', handleLogReceived)

    return () => {
      removeEventListener('logReceived', handleLogReceived)
    }
  }, [])

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [logs, isAutoScroll])

  const handleClearLogs = async () => {
    try {
      const success = await clearLogs()
      if (success) {
        setLogs([])
      }
    } catch (error) {
      console.error('Failed to clear logs:', error)
      // Clear local logs anyway
      setLogs([])
    }
  }



  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-500'
      case 'warning':
        return 'text-yellow-500'
      case 'info':
        return 'text-blue-500'
      case 'debug':
        return 'text-gray-500'
      default:
        return 'text-foreground'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>实时日志</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearLogs}
            disabled={logs.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            清空
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea 
          ref={scrollAreaRef}
          className="h-64 w-full rounded border bg-muted/30 p-3"
          onScroll={(e) => {
            const target = e.target as HTMLElement
            const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 10
            setIsAutoScroll(isAtBottom)
          }}
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {connectionStatus?.v2ray?.running ? '等待日志输出...' : '请先启动代理服务'}
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="text-xs font-mono">
                  <span className="text-muted-foreground">[{log.timestamp}]</span>
                  <span className={`ml-2 font-semibold ${getLevelColor(log.level)}`}>
                    {log.level.toUpperCase()}:
                  </span>
                  <span className="ml-2">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {!isAutoScroll && (
          <div className="mt-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAutoScroll(true)
                if (scrollAreaRef.current) {
                  const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
                  if (scrollElement) {
                    scrollElement.scrollTop = scrollElement.scrollHeight
                  }
                }
              }}
              className="text-xs"
            >
              滚动到底部
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}