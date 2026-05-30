import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class HackathonFileChangeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  filePath!: string;

  @IsString()
  @IsIn(['added', 'modified', 'deleted'])
  changeType!: 'added' | 'modified' | 'deleted';

  @IsInt()
  @Min(0)
  additions!: number;

  @IsInt()
  @Min(0)
  deletions!: number;
}

export class HackathonCommitInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  commitSha!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  commitMessage!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  authorUsername?: string;

  @IsDateString()
  committedAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  additions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  deletions?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HackathonFileChangeDto)
  files!: HackathonFileChangeDto[];
}

export class ScoreHackathonTeamDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HackathonCommitInputDto)
  commits!: HackathonCommitInputDto[];

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}