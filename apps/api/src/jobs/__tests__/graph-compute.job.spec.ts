import { GraphComputeJob } from '../graph-compute.job';
import { DeveloperGraphService } from '../../intelligence/developer-graph/developer-graph.service';

describe('GraphComputeJob', () => {
  it('computes graph and persists snapshots', async () => {
    const mockPrisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'user1' },
          { id: 'user2' },
        ]),
      },
    };

    const mockGraphService: any = {
      computeGraph: jest.fn().mockResolvedValue(undefined),
    };

    const job = new GraphComputeJob(mockPrisma, mockGraphService);
    await job.compute();

    expect(mockPrisma.user.findMany).toHaveBeenCalled();
    expect(mockGraphService.computeGraph).toHaveBeenCalledTimes(2);
  });
});
