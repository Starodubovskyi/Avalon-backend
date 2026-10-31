import { toUserCard } from '../../../../../users-directory/domain/user-card';
import { Person } from '../../../../domain/person';
import { PostData } from '../../../../domain/post';
import { PostCommentData } from '../../../../domain/post-comment';

interface AuthorColumns {
  authorId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleId: number | null;
}

export interface PostRow extends AuthorColumns {
  id: string;
  body: string;
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface CommentRow extends AuthorColumns {
  id: string;
  postId: string;
  body: string;
  createdAt: Date;
}

export interface PersonRow {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleId: number | null;
  followedByMe: boolean;
  followsMe: boolean;
  followers: number;
  following: number;
  posts: number;
}

function toAuthor(row: AuthorColumns) {
  return toUserCard({
    id: row.authorId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    roleId: row.roleId,
  });
}

export class SocialMapper {
  static toPost(row: PostRow): PostData {
    return {
      id: row.id,
      author: toAuthor(row),
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      likeCount: Number(row.likeCount),
      commentCount: Number(row.commentCount),
      likedByMe: Boolean(row.likedByMe),
    };
  }

  static toComment(row: CommentRow): PostCommentData {
    return {
      id: row.id,
      postId: row.postId,
      author: toAuthor(row),
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    };
  }

  static toPerson(row: PersonRow): Person {
    const person = Object.assign(new Person(), toUserCard(row));
    person.followedByMe = Boolean(row.followedByMe);
    person.followsMe = Boolean(row.followsMe);
    person.followers = Number(row.followers);
    person.following = Number(row.following);
    person.posts = Number(row.posts);
    return person;
  }
}
