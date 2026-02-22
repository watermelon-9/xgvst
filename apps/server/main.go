package main

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

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

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	_ = r.Run("127.0.0.1:8080")
}

func corsMiddleware() gin.HandlerFunc {
	allowedOrigins := map[string]bool{
		"https://xgvst-web.pages.dev":        true,
		"https://develop.xgvst-web.pages.dev": true,
		"https://xgvst.com":                  true,
		"https://www.xgvst.com":              true,
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if allowedOrigins[origin] {
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
