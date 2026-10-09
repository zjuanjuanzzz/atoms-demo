FROM node:24-alpine

WORKDIR /app

# 项目零第三方依赖，不需要 npm install，镜像构建只需要拷贝代码
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
