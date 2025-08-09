/**
 * GitHub SDK Integration Module
 * Provides GitHub API operations with proper error handling and TypeScript support
 */

import { Octokit } from '@octokit/rest';
import type { RestEndpointMethodTypes } from '@octokit/rest';
import { Logger } from '../utils/logger';
import { IntegrationError } from '../core/errors';

// Type aliases for GitHub API responses
type IssuesGetResponse = RestEndpointMethodTypes['issues']['get']['response']['data'];
type IssuesGetResponseLabel = NonNullable<IssuesGetResponse['labels']>[number];
type IssuesGetResponseAssignee = NonNullable<IssuesGetResponse['assignees']>[number];

export interface GitHubConfig {
  token?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<{ name: string; color: string; description?: string }>;
  assignees: Array<{ login: string; id: number }>;
  milestone?: { title: string; number: number } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface CreateIssueOptions {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

export interface GitHubRepository {
  owner: string;
  repo: string;
}

export class GitHubIntegration {
  private octokit: Octokit;
  private logger: Logger;

  constructor(config: GitHubConfig = {}, logger: Logger) {
    this.logger = logger;

    // Initialize Octokit with configuration
    this.octokit = new Octokit({
      auth: config.token || process.env.GITHUB_TOKEN,
      baseUrl: config.baseUrl || 'https://api.github.com',
      request: {
        timeout: config.timeout || 10000,
      },
    });
  }

  /**
   * Helper method to map GitHub API label responses to our interface format
   */
  private mapLabelsToInterface(
    labels: (string | IssuesGetResponseLabel)[]
  ): Array<{ name: string; color: string; description?: string }> {
    return labels.map((label: string | IssuesGetResponseLabel) => {
      if (typeof label === 'string') {
        return { name: label, color: '', description: undefined };
      }
      return {
        name: label.name || '',
        color: label.color || '',
        description: label.description || undefined,
      };
    });
  }

  /**
   * Parse GitHub issue URL or return repository info and issue number
   */
  parseIssueUrl(input: string): { owner: string; repo: string; issueNumber: number } {
    // Handle direct issue number
    if (/^\d+$/.test(input)) {
      throw new IntegrationError(
        'Issue number provided without repository context. Please provide full GitHub URL or set default repository.'
      );
    }

    // Handle GitHub URLs
    const urlRegex = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/;
    const match = input.match(urlRegex);

    if (!match) {
      throw new IntegrationError(
        `Invalid GitHub issue URL format: ${input}. Expected format: https://github.com/owner/repo/issues/123`
      );
    }

    const [, owner, repo, issueNumberStr] = match;
    const issueNumber = parseInt(issueNumberStr, 10);

    return { owner, repo, issueNumber };
  }

  /**
   * Validate GitHub authentication
   */
  async validateAuthentication(): Promise<boolean> {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      this.logger.info(`GitHub authentication successful for user: ${data.login}`);
      return true;
    } catch (error) {
      this.logger.warn('GitHub authentication failed', String(error));
      return false;
    }
  }

  /**
   * Fetch GitHub issue by URL or repository/number
   */
  async fetchIssue(issueUrl: string): Promise<GitHubIssue> {
    try {
      const { owner, repo, issueNumber } = this.parseIssueUrl(issueUrl);

      this.logger.info(`Fetching GitHub issue: ${owner}/${repo}#${issueNumber}`);

      const { data } = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      // Transform the response to our interface
      const issue: GitHubIssue = {
        id: data.id,
        number: data.number,
        title: data.title,
        body: data.body || null,
        state: data.state as 'open' | 'closed',
        labels: this.mapLabelsToInterface(data.labels),
        assignees:
          data.assignees?.map((assignee: IssuesGetResponseAssignee) => {
            return {
              login: assignee.login || '',
              id: assignee.id || 0,
            };
          }) || [],
        milestone: data.milestone
          ? {
              title: data.milestone.title,
              number: data.milestone.number,
            }
          : null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        html_url: data.html_url,
        user: {
          login: data.user?.login || '',
          id: data.user?.id || 0,
          avatar_url: data.user?.avatar_url || '',
        },
      };

      return issue;
    } catch (error: unknown) {
      const errorObj = error as { status?: number };
      if (errorObj.status === 404) {
        throw new IntegrationError(`GitHub issue not found: ${issueUrl}`);
      } else if (errorObj.status === 403) {
        throw new IntegrationError(
          `GitHub API access denied. Check authentication token and rate limits.`
        );
      } else if (errorObj.status === 401) {
        throw new IntegrationError(`GitHub authentication failed. Check your access token.`);
      }

      throw new IntegrationError(`Failed to fetch GitHub issue: ${String(error)}`);
    }
  }

  /**
   * Create a new GitHub issue
   */
  async createIssue(
    repository: GitHubRepository,
    options: CreateIssueOptions
  ): Promise<GitHubIssue> {
    try {
      this.logger.info(
        `Creating GitHub issue in ${repository.owner}/${repository.repo}: ${options.title}`
      );

      const { data } = await this.octokit.rest.issues.create({
        owner: repository.owner,
        repo: repository.repo,
        title: options.title,
        body: options.body || '',
        labels: options.labels || [],
        assignees: options.assignees || [],
        milestone: options.milestone,
      });

      // Transform the response to our interface
      const issue: GitHubIssue = {
        id: data.id,
        number: data.number,
        title: data.title,
        body: data.body || null,
        state: data.state as 'open' | 'closed',
        labels: this.mapLabelsToInterface(data.labels),
        assignees:
          data.assignees?.map((assignee: IssuesGetResponseAssignee) => {
            return {
              login: assignee.login || '',
              id: assignee.id || 0,
            };
          }) || [],
        milestone: data.milestone
          ? {
              title: data.milestone.title,
              number: data.milestone.number,
            }
          : null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        html_url: data.html_url,
        user: {
          login: data.user?.login || '',
          id: data.user?.id || 0,
          avatar_url: data.user?.avatar_url || '',
        },
      };

      this.logger.info(`Successfully created GitHub issue #${issue.number}: ${issue.html_url}`);
      return issue;
    } catch (error: unknown) {
      const errorObj = error as { status?: number };
      if (errorObj.status === 403) {
        throw new IntegrationError(
          `GitHub API access denied. Check authentication token and repository permissions.`
        );
      } else if (errorObj.status === 404) {
        throw new IntegrationError(
          `GitHub repository not found: ${repository.owner}/${repository.repo}`
        );
      } else if (errorObj.status === 401) {
        throw new IntegrationError(`GitHub authentication failed. Check your access token.`);
      }

      throw new IntegrationError(`Failed to create GitHub issue: ${String(error)}`);
    }
  }

  /**
   * Create multiple GitHub issues with retry logic
   */
  async createMultipleIssues(
    repository: GitHubRepository,
    issues: CreateIssueOptions[],
    retryOptions: { maxRetries?: number; delayMs?: number } = {}
  ): Promise<GitHubIssue[]> {
    const { maxRetries = 3, delayMs = 1000 } = retryOptions;
    const createdIssues: GitHubIssue[] = [];

    for (const issueOptions of issues) {
      let retries = 0;
      let lastError: Error | null = null;

      while (retries <= maxRetries) {
        try {
          const issue = await this.createIssue(repository, issueOptions);
          createdIssues.push(issue);

          // Rate limiting: wait between requests
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          break; // Success, move to next issue
        } catch (error) {
          lastError = error as Error;
          retries++;

          if (retries <= maxRetries) {
            this.logger.warn(`Retry ${retries}/${maxRetries} for issue: ${issueOptions.title}`);
            await new Promise((resolve) => setTimeout(resolve, delayMs * retries));
          }
        }
      }

      if (retries > maxRetries && lastError) {
        throw new IntegrationError(
          `Failed to create issue "${issueOptions.title}" after ${maxRetries} retries: ${lastError.message}`
        );
      }
    }

    return createdIssues;
  }

  /**
   * Get rate limit information
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  }> {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();

      return {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: new Date(data.rate.reset * 1000),
        used: data.rate.used,
      };
    } catch (error) {
      throw new IntegrationError(`Failed to get GitHub rate limit: ${String(error)}`);
    }
  }

  /**
   * Check if the GitHub integration is properly configured
   */
  isConfigured(): boolean {
    return !!(process.env.GITHUB_TOKEN || this.octokit.auth);
  }
}
