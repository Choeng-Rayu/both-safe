import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type ActorType =
  | 'participant'
  | 'creator'
  | 'invite'
  | 'admin'
  | 'public';

export interface RequestActor {
  type: ActorType;
  // when participant or creator, role and dealId are present
  role?: 'buyer' | 'seller';
  dealId?: string;
  participantId?: string;
  adminId?: string;
  rawToken?: string;
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestActor => {
    const req = ctx.switchToHttp().getRequest();
    return req.actor ?? { type: 'public' };
  },
);
