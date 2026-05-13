/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'user' | 'employee' | 'owner' | null;

export interface MediaItem {
  id: string;
  title: string;
  description: string;
  rating: number;
  year: number;
  duration: string;
  genre: string[];
  language: 'Bollywood' | 'Hollywood' | 'English' | 'Hindi' | 'Kannada' | 'Korean' | 'Japanese' | 'Spanish' | 'French' | 'German' | 'Telugu' | 'Tamil' | 'Malayalam' | 'Chinese';
  thumbnailUrl: string;
  bannerUrl: string;
  mediaType: 'movie' | 'tv-show';
}

export type Category = 'Home' | 'Movies' | 'TV Shows' | 'Trending' | 'My List';
