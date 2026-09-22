import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../client';
import {
  exportRecruiterApplications,
  exportRecruiterInterviews,
  exportAdminUsers,
  triggerBlobDownload,
} from '../export';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('Export API Services (Phase 30B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggerBlobDownload creates an anchor and clicks it', () => {
    const mockBlob = new Blob(['test,csv,data'], { type: 'text/csv' });
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/test');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    triggerBlobDownload(mockBlob, 'test_export.csv');

    expect(createObjectURLMock).toHaveBeenCalledWith(mockBlob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/test');
  });

  it('exportRecruiterApplications calls the correct endpoint with blob responseType', async () => {
    const mockBlob = new Blob(['col1,col2\nval1,val2'], { type: 'text/csv' });
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockBlob });

    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/app');
    window.URL.revokeObjectURL = vi.fn();

    await exportRecruiterApplications();

    expect(apiClient.get).toHaveBeenCalledWith('/recruiter/applications/export', {
      responseType: 'blob',
    });
  });

  it('exportRecruiterInterviews calls the correct endpoint with blob responseType', async () => {
    const mockBlob = new Blob(['col1,col2\nval1,val2'], { type: 'text/csv' });
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockBlob });

    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/itv');
    window.URL.revokeObjectURL = vi.fn();

    await exportRecruiterInterviews();

    expect(apiClient.get).toHaveBeenCalledWith('/recruiter/interviews/export', {
      responseType: 'blob',
    });
  });

  it('exportAdminUsers calls the correct endpoint with blob responseType', async () => {
    const mockBlob = new Blob(['col1,col2\nval1,val2'], { type: 'text/csv' });
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockBlob });

    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/admin');
    window.URL.revokeObjectURL = vi.fn();

    await exportAdminUsers();

    expect(apiClient.get).toHaveBeenCalledWith('/admin/users/export', {
      responseType: 'blob',
    });
  });
});
