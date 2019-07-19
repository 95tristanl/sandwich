module.exports = {
  apps : [
      {
        name: "",
        script: "./server.js",
        watch: true,
        env: {
            "PORT": 8080,//you can choose
            "NODE_ENV": "development"
        },
        env_production: {
            "PORT": 4000,//you can choose
            "NODE_ENV": "production",
        }
      }
  ]
}
