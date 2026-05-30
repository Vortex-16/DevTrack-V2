import { GraphComputeJob } from '../graph-compute.job';

describe('GraphComputeJob', () => {
  it('computes graph and persists snapshots', async () => {
    const commits = [
      { authorId: 'u1', repositoryId: 'r1' },
      { authorId: 'u2', repositoryId: 'r1' },
      { authorId: 'u1', repositoryId: 'r2' },
      { authorId: 'u3', repositoryId: 'r2' },
      { authorId: 'u2', repositoryId: 'r3' },
    ];

    const created: any[] = [];
    const updated: any[] = [];

    const mockPrisma: any = {
      commit: { findMany: jest.fn().mockResolvedValue(commits) },
      developerGraph: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async (opts: any) => { created.push(opts); return opts; }),
        update: jest.fn(async (opts: any) => { updated.push(opts); return opts; }),
      },
    };

    const job = new GraphComputeJob(mockPrisma as any);
    await job.compute();

    // Expect at least one create call for users present in commits
    expect(mockPrisma.commit.findMany).toHaveBeenCalled();
    expect(created.length + updated.length).toBeGreaterThan(0);
  });
});
