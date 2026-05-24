import { Module } from '@nestjs/common';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';
import { GithubApiClient } from './github-api.client';
import { GithubTokenService } from './github-token.service';
import { GithubOAuthService } from './github-oauth.service';

@Module({
  controllers: [GithubController],
  providers: [GithubService, GithubApiClient, GithubTokenService, GithubOAuthService],
  exports: [GithubService, GithubOAuthService],
})
export class GithubModule {}
