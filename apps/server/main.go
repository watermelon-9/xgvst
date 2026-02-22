package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		return allowedOrigins()[origin]
	},
}

func main() {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "xgvst-api",
			"status":  "connected",
			"ts":      time.Now().UnixMilli(),
		})
	})

	r.GET("/status", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "xgvst-api",
			"status":  "connected",
			"ts":      time.Now().UnixMilli(),
		})
	})

	r.GET("/v3/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"version": "v3.0.0",
			"tunnel":  "Cloudflare",
		})
	})

	r.GET("/v3/blob", func(c *gin.Context) {
		size := 1024 * 1024 // 1MB default
		if q := strings.TrimSpace(c.Query("bytes")); q != "" {
			if n, err := strconv.Atoi(q); err == nil && n > 0 && n <= 5*1024*1024 {
				size = n
			}
		}

		payload := strings.Repeat("x", size)
		c.Data(http.StatusOK, "application/octet-stream", []byte(payload))
	})

	r.GET("/ws", handleMarketWS)

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	_ = r.Run("127.0.0.1:8080")
}

func handleMarketWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	conn.SetReadLimit(1 << 20)
	_ = conn.SetReadDeadline(time.Now().Add(40 * time.Second))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(40 * time.Second))
	})

	done := make(chan struct{})
	outbound := make(chan []byte, 16)

	go func() {
		tickTicker := time.NewTicker(3 * time.Second)
		pingTicker := time.NewTicker(10 * time.Second)
		defer tickTicker.Stop()
		defer pingTicker.Stop()

		for {
			select {
			case <-done:
				return
			case msg := <-outbound:
				_ = conn.SetWriteDeadline(time.Now().Add(8 * time.Second))
				if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					return
				}
			case t := <-tickTicker.C:
				payload, _ := json.Marshal(gin.H{
					"type":  "tick",
					"ts":    t.UnixMilli(),
					"price": 12.34,
				})
				_ = conn.SetWriteDeadline(time.Now().Add(8 * time.Second))
				if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
					return
				}
			case <-pingTicker.C:
				deadline := time.Now().Add(5 * time.Second)
				if err := conn.WriteControl(websocket.PingMessage, []byte("cf-ping"), deadline); err != nil {
					return
				}
			}
		}
	}()

	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			close(done)
			return
		}

		if msgType != websocket.TextMessage && msgType != websocket.BinaryMessage {
			continue
		}

		text := strings.TrimSpace(string(data))
		if strings.Contains(text, `"type":"ping"`) || text == "ping" {
			payload, _ := json.Marshal(gin.H{"type": "pong", "ts": time.Now().UnixMilli()})
			select {
			case outbound <- payload:
			default:
			}
			continue
		}

		ack, _ := json.Marshal(gin.H{"type": "ack", "ts": time.Now().UnixMilli()})
		select {
		case outbound <- ack:
		default:
		}
	}
}

func corsMiddleware() gin.HandlerFunc {
	origins := allowedOrigins()

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origins[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Header("Access-Control-Max-Age", "86400")
			c.Header("Access-Control-Allow-Credentials", "true")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func allowedOrigins() map[string]bool {
	return map[string]bool{
		"https://xgvst-web.pages.dev":         true,
		"https://develop.xgvst-web.pages.dev": true,
		"https://xgvst.com":                   true,
		"https://www.xgvst.com":               true,
		"http://127.0.0.1:3333":               true,
		"http://localhost:3333":               true,
		"http://127.0.0.1:5174":               true,
		"http://localhost:5174":               true,
	}
}
