package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.New()
	r.Use(gin.Recovery())

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

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	_ = r.Run("127.0.0.1:8080")
}
