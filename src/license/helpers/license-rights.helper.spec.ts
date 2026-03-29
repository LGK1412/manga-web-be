import {
  appendLicenseRejectReason,
  clearCurrentLicenseRejectReason,
  getLicenseRejectReasonHistory,
  syncLegacyLicenseFromRights,
} from './license-rights.helper';
import {
  MangaLicenseStatus,
  RightsReviewStatus,
} from 'src/schemas/Manga.schema';

describe('license reject reason history helpers', () => {
  it('falls back to the legacy single reject reason', () => {
    const manga = {
      licenseRejectReason: 'Missing owner authorization',
    };

    expect(getLicenseRejectReasonHistory(manga)).toEqual([
      'Missing owner authorization',
    ]);
  });

  it('preserves the legacy reject reason when clearing the current reason', () => {
    const manga: any = {
      licenseRejectReason: 'Wrong license file',
    };

    clearCurrentLicenseRejectReason(manga);

    expect(manga.licenseRejectReason).toBe('');
    expect(manga.licenseRejectReasons).toEqual(['Wrong license file']);
  });

  it('appends a new reject reason to the existing history', () => {
    const manga: any = {
      licenseRejectReason: 'First rejection',
      licenseRejectReasons: ['First rejection'],
    };

    appendLicenseRejectReason(manga, 'Second rejection');

    expect(manga.licenseRejectReason).toBe('Second rejection');
    expect(manga.licenseRejectReasons).toEqual([
      'First rejection',
      'Second rejection',
    ]);
  });

  it('clears the current reject reason when rights move back to pending', () => {
    const manga: any = {
      licenseStatus: MangaLicenseStatus.REJECTED,
      licenseRejectReason: 'Need a signed contract',
      rights: {
        reviewStatus: RightsReviewStatus.PENDING,
        rejectReason: '',
      },
    };

    syncLegacyLicenseFromRights(manga);

    expect(manga.licenseStatus).toBe(MangaLicenseStatus.PENDING);
    expect(manga.licenseRejectReason).toBe('');
    expect(manga.licenseRejectReasons).toEqual(['Need a signed contract']);
  });
});
